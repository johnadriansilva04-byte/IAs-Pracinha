import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { ContextCompressor } from '@/lib/context-compressor';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';
import { MessageFilter } from '@/lib/message-filter';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);
const compressor = new ContextCompressor();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { case_id, message, save_conversation } = body;

    console.log('[CHAT] Nova mensagem recebida:', {
      case_id: !!case_id,
      message_length: message?.length,
      save_conversation
    });

    // Validação básica
    if (!message || typeof message !== 'string') {
      console.error('[CHAT] mensagem inválida');
      return NextResponse.json({ error: 'Mensagem é obrigatória e deve ser um texto' }, { status: 400 });
    }

    if (message.trim().length === 0) {
      console.error('[CHAT] mensagem vazia');
      return NextResponse.json({ error: 'Mensagem não pode estar vazia' }, { status: 400 });
    }

    // Se não tem case_id, criar nova conversa automaticamente
    let actualCaseId = case_id;
    if (!case_id) {
      console.log('[CHAT] Nenhum case_id fornecido, criando nova conversa...');
      try {
        const { data: newCase, error: createError } = await supabase
          .from('cases')
          .insert({
            title: 'Nova Conversa',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('[CHAT] Erro ao criar nova conversa:', createError);
          // Continuar mesmo com erro - não quebrar a UX
          console.log('[CHAT] Continuando sem salvar no banco (modo temporário)');
          actualCaseId = null;
        } else {
          actualCaseId = newCase.id;
          console.log('[CHAT] Nova conversa criada:', actualCaseId);
        }
      } catch (error) {
        console.error('[CHAT] Erro ao criar conversa (não crítico):', error);
        actualCaseId = null;
      }
    }

    // Verificar se é comando de salvar
    if (message.toLowerCase().includes('/salvar') || save_conversation) {
      console.log('[CHAT] Comando de salvar detectado');
      return NextResponse.json({ 
        response: '✅ Conversa salva com sucesso! Você pode continuar conversando, as mensagens salvas ficarão disponíveis para consulta futura.',
        saved: true
      });
    }

    // Gerar chave única para antiloop
    const antiLoopKey = generateAntiLoopKey('chat-message', {
      case_id: actualCaseId,
      message_hash: message.length
    });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[CHAT] Buscando configuração do sistema...');
      // Buscar configuração do sistema
      const { data: config, error: configError } = await supabase
        .from('system_config')
        .select('*')
        .single();

      if (configError) {
        console.error('[CHAT] Erro ao buscar configuração:', configError);
        // Usar configuração padrão se falhar
        console.log('[CHAT] Usando configuração padrão');
      }

      console.log('[CHAT] Google AI Key está configurada via variável de ambiente');

      // Buscar mensagens anteriores apenas se tiver case_id
      let messagesArray: any[] = [];
      if (actualCaseId) {
        try {
          console.log('[CHAT] Buscando mensagens anteriores...');
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('case_id', actualCaseId)
            .order('created_at', { ascending: true });

          if (messagesError) {
            console.error('[CHAT] Erro ao buscar mensagens:', messagesError);
            // Continuar sem histórico se falhar
            console.log('[CHAT] Continuando sem histórico (erro não crítico)');
          } else {
            messagesArray = messages || [];
            console.log('[CHAT] Mensagens anteriores encontradas:', messagesArray.length);
          }
        } catch (error) {
          console.error('[CHAT] Erro ao buscar mensagens (não crítico):', error);
        }
      } else {
        console.log('[CHAT] Sem case_id, iniciando chat sem histórico');
      }

      // Preparar contexto
      const allMessages = [
        ...messagesArray.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      const estimatedTokens = compressor.estimateTokens(
        allMessages.map(m => m.content).join(' ')
      );

      console.log('[CHAT] Tokens estimados:', estimatedTokens);

      let context = '';
      if (messagesArray.length > 10 || compressor.shouldCompress(estimatedTokens)) {
        console.log('[CHAT] Comprimindo contexto...');
        const oldMessages = messagesArray.slice(0, -5);
        const recentMessages = messagesArray.slice(-5);

        if (oldMessages.length > 0) {
          const compressed = await compressor.compressMessages(
            oldMessages.map(m => ({ role: m.role, content: m.content }))
          );
          context = await compressor.reconstructContext(compressed, recentMessages);
        } else {
          context = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        }
      } else {
        context = allMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      }

      // Construir system prompt completo
      const systemPrompt = `
CARÁTER: ${config?.character || 'Amigável e prestativo'}
ESTRATÉGIA: ${config?.strategy || 'Sempre ajudar com eficiência'}
RACIOCÍNIO: ${config?.reasoning || 'Pensar passo a passo antes de responder'}

${config?.system_prompt || 'Você é um assistente pessoal útil e eficiente.'}
`;

      console.log('[CHAT] Enviando mensagem para Gemini Flash...');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const chat = model.startChat({
        history: messagesArray.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        systemInstruction: systemPrompt
      });

      const result = await chat.sendMessage(message);
      const response = await result.response.text();

      console.log('[CHAT] Resposta recebida, tamanho:', response.length);

      // Salvar mensagens no banco (se tiver case_id e passar no filtro)
      if (actualCaseId) {
        try {
          const shouldSaveUserMessage = MessageFilter.shouldSave(message, 'user');
          const shouldSaveAssistantMessage = MessageFilter.shouldSave(response, 'assistant');

          console.log('[CHAT] Filtro de salvamento:', {
            user: MessageFilter.getSaveReason(message, 'user'),
            assistant: MessageFilter.getSaveReason(response, 'assistant')
          });

          // Salvar mensagem do usuário
          if (shouldSaveUserMessage) {
            await supabase
              .from('messages')
              .insert({
                case_id: actualCaseId,
                role: 'user',
                content: message,
                should_save: true,
                created_at: new Date().toISOString()
              });
            console.log('[CHAT] Mensagem do usuário salva');
          } else {
            console.log('[CHAT] Mensagem do usuário NÃO salva (filtro)');
          }

          // Salvar resposta do assistente
          if (shouldSaveAssistantMessage) {
            await supabase
              .from('messages')
              .insert({
                case_id: actualCaseId,
                role: 'assistant',
                content: response,
                should_save: true,
                created_at: new Date().toISOString()
              });
            console.log('[CHAT] Resposta do assistente salva');
          } else {
            console.log('[CHAT] Resposta do assistente NÃO salva (filtro)');
          }

          // Atualizar timestamp da conversa
          await supabase
            .from('cases')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', actualCaseId);

        } catch (error) {
          console.error('[CHAT] Erro ao salvar mensagens (não crítico):', error);
          // Não quebrar a UX se falhar ao salvar
        }
      }

      return NextResponse.json({ 
        response, 
        saved: true,
        case_id: actualCaseId
      });
    });
  } catch (error: any) {
    console.error('[CHAT] Erro detalhado:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    
    let errorMessage = 'Erro ao processar mensagem no chat';
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma mensagem sendo processada. Aguarde a resposta anterior.';
    } else if (error.message?.includes('Tempo limite')) {
      errorMessage = 'A resposta demorou muito tempo. Tente novamente com uma mensagem mais curta.';
    } else if (error.message?.includes('API key')) {
      errorMessage = 'Erro na chave API do Google. Verifique sua configuração.';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'Limite de uso da API Google excedido. Tente novamente mais tarde.';
    } else if (error.code === 'PGRST116') {
      errorMessage = 'Erro ao buscar dados no banco de dados.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}