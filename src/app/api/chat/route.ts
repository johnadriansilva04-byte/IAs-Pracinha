import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { ContextCompressor } from '@/lib/context-compressor';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';
import { MessageFilter } from '@/lib/message-filter';
import { DEFAULT_CONFIG } from '@/lib/default-config';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);
const compressor = new ContextCompressor();

console.log('[CHAT-INIT] API inicializada. Google AI Key configurada:', !!GOOGLE_AI_KEY);

export async function POST(request: NextRequest) {
  try {
    console.log('[CHAT-START] === INÍCIO DA REQUISIÇÃO ===');
    const body = await request.json();
    const { case_id, message, save_conversation } = body;

    console.log('[CHAT-PARAMS] Parâmetros recebidos:', {
      case_id: case_id || 'null',
      message_length: message?.length,
      message_preview: message?.substring(0, 50),
      save_conversation
    });

    // Validação básica
    if (!message || typeof message !== 'string') {
      console.error('[CHAT-ERROR] Mensagem inválida:', typeof message);
      return NextResponse.json({ error: 'Mensagem é obrigatória e deve ser um texto' }, { status: 400 });
    }

    if (message.trim().length === 0) {
      console.error('[CHAT-ERROR] Mensagem vazia');
      return NextResponse.json({ error: 'Mensagem não pode estar vazia' }, { status: 400 });
    }

    // Se não tem case_id, criar nova conversa automaticamente
    let actualCaseId = case_id;
    if (!case_id) {
      console.log('[CHAT-CREATE] Nenhum case_id fornecido, criando nova conversa...');
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
          console.error('[CHAT-CREATE-ERROR] Erro ao criar nova conversa:', createError);
          console.log('[CHAT-CREATE-CONTINUE] Continuando sem salvar no banco (modo temporário)');
          actualCaseId = null;
        } else {
          actualCaseId = newCase.id;
          console.log('[CHAT-CREATE-SUCCESS] Nova conversa criada:', actualCaseId);
        }
      } catch (error) {
        console.error('[CHAT-CREATE-EXCEPTION] Erro ao criar conversa (não crítico):', error);
        actualCaseId = null;
      }
    } else {
      console.log('[CHAT-CASE] Usando case_id existente:', actualCaseId);
    }

    // Verificar se é comando de salvar
    if (message.toLowerCase().includes('/salvar') || save_conversation) {
      console.log('[CHAT-SAVE] Comando de salvar detectado');
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
      console.log('[CHAT-CONFIG] Buscando configuração do sistema...');
      // Buscar configuração do sistema
      const { data: config, error: configError } = await supabase
        .from('system_config')
        .select('*')
        .single();

      if (configError) {
        console.error('[CHAT-CONFIG-ERROR] Erro ao buscar configuração:', configError);
        console.log('[CHAT-CONFIG-FALLBACK] Usando configuração padrão - Pracinha da Força Expedicionária Brasileira');
      } else {
        console.log('[CHAT-CONFIG-SUCCESS] Configuração encontrada');
      }

      // Usar configuração do banco ou padrão
      const effectiveConfig = config || DEFAULT_CONFIG;

      console.log('[CHAT-GEMINI] Google AI Key configurada:', !!GOOGLE_AI_KEY);

      // Buscar mensagens anteriores apenas se tiver case_id
      let messagesArray: any[] = [];
      if (actualCaseId) {
        try {
          console.log('[CHAT-MESSAGES] Buscando mensagens anteriores...');
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('case_id', actualCaseId)
            .order('created_at', { ascending: true });

          if (messagesError) {
            console.error('[CHAT-MESSAGES-ERROR] Erro ao buscar mensagens:', messagesError);
            console.log('[CHAT-MESSAGES-CONTINUE] Continuando sem histórico (erro não crítico)');
          } else {
            messagesArray = messages || [];
            console.log('[CHAT-MESSAGES-SUCCESS] Mensagens encontradas:', messagesArray.length);
          }
        } catch (error) {
          console.error('[CHAT-MESSAGES-EXCEPTION] Erro ao buscar mensagens (não crítico):', error);
        }
      } else {
        console.log('[CHAT-MESSAGES] Sem case_id, iniciando chat sem histórico');
      }

      // Preparar contexto
      const allMessages = [
        ...messagesArray.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      const estimatedTokens = compressor.estimateTokens(
        allMessages.map(m => m.content).join(' ')
      );

      console.log('[CHAT-TOKENS] Tokens estimados:', estimatedTokens);

      let context = '';
      if (messagesArray.length > 10 || compressor.shouldCompress(estimatedTokens)) {
        console.log('[CHAT-COMPRESS] Comprimindo contexto...');
        const oldMessages = messagesArray.slice(0, -5);
        const recentMessages = messagesArray.slice(-5);

        if (oldMessages.length > 0) {
          try {
            const compressed = await compressor.compressMessages(
              oldMessages.map(m => ({ role: m.role, content: m.content }))
            );
            context = await compressor.reconstructContext(compressed, recentMessages);
            console.log('[CHAT-COMPRESS-SUCCESS] Contexto comprimido');
          } catch (compressError) {
            console.error('[CHAT-COMPRESS-ERROR] Erro ao comprimir:', compressError);
            context = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
          }
        } else {
          context = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        }
      } else {
        context = allMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      }

      // Construir system prompt completo
      const systemPrompt = `
CARÁTER: ${effectiveConfig.character}
ESTRATÉGIA: ${effectiveConfig.strategy}
RACIOCÍNIO: ${effectiveConfig.reasoning}

${effectiveConfig.system_prompt}
`;

      console.log('[CHAT-GEMINI-START] Enviando mensagem para Gemini Flash...');
      try {
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

        console.log('[CHAT-GEMINI-SUCCESS] Resposta recebida, tamanho:', response.length);

        // Salvar mensagens no banco (se tiver case_id e passar no filtro)
        if (actualCaseId) {
          try {
            console.log('[CHAT-SAVE] Iniciando salvamento no banco...');
            const shouldSaveUserMessage = MessageFilter.shouldSave(message, 'user');
            const shouldSaveAssistantMessage = MessageFilter.shouldSave(response, 'assistant');

            console.log('[CHAT-FILTER] Filtro de salvamento:', {
              user: MessageFilter.getSaveReason(message, 'user'),
              assistant: MessageFilter.getSaveReason(response, 'assistant')
            });

            // Salvar mensagem do usuário
            if (shouldSaveUserMessage) {
              const { error: userSaveError } = await supabase
                .from('messages')
                .insert({
                  case_id: actualCaseId,
                  role: 'user',
                  content: message,
                  should_save: true,
                  created_at: new Date().toISOString()
                });
              
              if (userSaveError) {
                console.error('[CHAT-SAVE-USER-ERROR] Erro ao salvar mensagem do usuário:', userSaveError);
              } else {
                console.log('[CHAT-SAVE-USER-SUCCESS] Mensagem do usuário salva');
              }
            } else {
              console.log('[CHAT-SAVE-USER-SKIP] Mensagem do usuário NÃO salva (filtro)');
            }

            // Salvar resposta do assistente
            if (shouldSaveAssistantMessage) {
              const { error: assistantSaveError } = await supabase
                .from('messages')
                .insert({
                  case_id: actualCaseId,
                  role: 'assistant',
                  content: response,
                  should_save: true,
                  created_at: new Date().toISOString()
                });
              
              if (assistantSaveError) {
                console.error('[CHAT-SAVE-ASSISTANT-ERROR] Erro ao salvar resposta:', assistantSaveError);
              } else {
                console.log('[CHAT-SAVE-ASSISTANT-SUCCESS] Resposta do assistente salva');
              }
            } else {
              console.log('[CHAT-SAVE-ASSISTANT-SKIP] Resposta do assistente NÃO salva (filtro)');
            }

            // Atualizar timestamp da conversa
            try {
              await supabase
                .from('cases')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', actualCaseId);
              console.log('[CHAT-UPDATE-SUCCESS] Timestamp da conversa atualizado');
            } catch (updateError) {
              console.error('[CHAT-UPDATE-ERROR] Erro ao atualizar timestamp (não crítico):', updateError);
            }

          } catch (saveError) {
            console.error('[CHAT-SAVE-EXCEPTION] Erro ao salvar mensagens (não crítico):', saveError);
            // Não quebrar a UX se falhar ao salvar
          }
        } else {
          console.log('[CHAT-SAVE] Sem case_id, não salvando no banco');
        }

        console.log('[CHAT-SUCCESS] === REQUISIÇÃO CONCLUÍDA COM SUCESSO ===');
        return NextResponse.json({ 
          response, 
          saved: true,
          case_id: actualCaseId
        });

      } catch (geminiError: any) {
        console.error('[CHAT-GEMINI-ERROR] Erro ao chamar Gemini:', {
          message: geminiError.message,
          code: geminiError.code,
          stack: geminiError.stack
        });
        throw new Error(`Erro ao chamar API do Gemini: ${geminiError.message}`);
      }
    });
  } catch (error: any) {
    console.error('[CHAT-FATAL-ERROR] Erro fatal na requisição:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    
    let errorMessage = 'Erro ao processar mensagem no chat';
    let errorDetails = error.message;
    
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma mensagem sendo processada. Aguarde a resposta anterior.';
    } else if (error.message?.includes('Tempo limite')) {
      errorMessage = 'A resposta demorou muito tempo. Tente novamente com uma mensagem mais curta.';
    } else if (error.message?.includes('API key') || error.message?.includes('401')) {
      errorMessage = 'Erro na chave API do Google. Verifique sua configuração.';
    } else if (error.message?.includes('quota') || error.message?.includes('429')) {
      errorMessage = 'Limite de uso da API Google excedido. Tente novamente mais tarde.';
    } else if (error.message?.includes('PGRST116')) {
      errorMessage = 'Erro ao buscar dados no banco de dados.';
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela não existe no banco. Execute o SQL supabase-reset.sql.';
    } else if (error.message?.includes('Gemini')) {
      errorMessage = 'Erro na API do Google Gemini.';
    }
    
    console.log('[CHAT-RESPONSE] Retornando erro:', { errorMessage, errorDetails });
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails 
    }, { status: 500 });
  }
}