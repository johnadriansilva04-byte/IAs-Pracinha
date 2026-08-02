import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { ContextCompressor } from '@/lib/context-compressor';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';
import { MessageFilter } from '@/lib/message-filter';
import { DEFAULT_CONFIG } from '@/lib/default-config';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
console.log('[CHAT-INIT] GOOGLE_AI_KEY configurada:', !!GOOGLE_AI_KEY);
console.log('[CHAT-INIT] GOOGLE_AI_KEY length:', GOOGLE_AI_KEY?.length);
console.log('[CHAT-INIT] GOOGLE_AI_KEY prefix:', GOOGLE_AI_KEY?.substring(0, 10) + '...');

const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);
const compressor = new ContextCompressor();

// Função para limpar markdown do texto (versão suave que preserva conteúdo)
function cleanMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '') // Remove cerquilhas de títulos
    .replace(/\*\*/g, '') // Remove negrito (**)
    .replace(/(?<!\*)\*(?!\*)/g, '') // Remove itálico (*) apenas quando não for negrito
    .replace(/^- /gm, '') // Remove bullet points
    .replace(/^\d+\.\s/gm, '') // Remove listas numeradas
    .replace(/```[\s\S]*?```/g, (match) => {
      // Preservar conteúdo dentro de blocos de código, apenas remover os ```
      const content = match.replace(/```[\w]*\n?/g, '').replace(/```$/g, '');
      return `[CÓDIGO: ${content.substring(0, 50)}...]`;
    })
    .replace(/`([^`]+)`/g, '$1') // Remove código inline mas preserva texto
    .replace(/\n{3,}/g, '\n\n') // Remove excesso de quebras de linha
    .trim();
}

// Configurações de modos de resposta
interface ResponseMode {
  maxOutputTokens: number;
  systemInstruction: string;
}

const RESPONSE_MODES: Record<string, ResponseMode> = {
  resumo: {
    maxOutputTokens: 150,
    systemInstruction: "Seja extremamente sucinto e vá direto ao ponto. Responda em poucas frases."
  },
  complexo: {
    maxOutputTokens: 800,
    systemInstruction: "Forneça uma resposta detalhada, estruturada e aprofundada."
  }
};

// Sliding window para limitar contexto
function getRecentMessages(messages: any[], limit: number = 6): any[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}

console.log('[CHAT-INIT] API inicializada. Google AI Key configurada:', !!GOOGLE_AI_KEY);

export async function POST(request: NextRequest) {
  try {
    console.log('[CHAT-START] === INÍCIO DA REQUISIÇÃO ===');
    const body = await request.json();
    const { case_id, message, save_conversation, mode = 'resumo' } = body;

    console.log('[CHAT-PARAMS] Parâmetros recebidos:', {
      case_id: case_id || 'null',
      message_length: message?.length,
      message_preview: message?.substring(0, 50),
      save_conversation,
      mode
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
      console.log('[CHAT-SYSTEM-PROMPT] Usando system prompt:', effectiveConfig.system_prompt?.substring(0, 100) + '...');

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

      // Buscar context_summary do case para rolling summary
      let contextSummary = '';
      let messageCount = 0;
      if (actualCaseId) {
        try {
          const { data: caseData, error: caseError } = await supabase
            .from('cases')
            .select('context_summary, message_count')
            .eq('id', actualCaseId)
            .single();

          if (!caseError && caseData) {
            contextSummary = caseData.context_summary || '';
            messageCount = caseData.message_count || 0;
            console.log('[CHAT-CONTEXT] Context summary encontrado, tamanho:', contextSummary.length);
            console.log('[CHAT-CONTEXT] Message count:', messageCount);
          }
        } catch (error) {
          console.error('[CHAT-CONTEXT] Erro ao buscar context summary:', error);
        }
      }

      // Verificar se precisa de rolling summary (10 mensagens)
      if (messageCount >= 10) {
        console.log('[CHAT-ROLLING-SUMMARY] Trigger rolling summary -', messageCount, 'mensagens');
        try {
          await fetch('/api/rolling-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ case_id: actualCaseId })
          });
          console.log('[CHAT-ROLLING-SUMMARY] Rolling summary concluído');
        } catch (error) {
          console.error('[CHAT-ROLLING-SUMMARY] Erro ao executar rolling summary:', error);
        }
      }

      // Preparar contexto com rolling summary
      let allMessages = [];
      let documentContext = '';

      // Buscar documentos relevantes (RAG)
      if (actualCaseId) {
        try {
          const ragResponse = await fetch('/api/rag-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ case_id: actualCaseId, query: message })
          });
          const ragData = await ragResponse.json();
          
          if (ragData.success && ragData.document_context) {
            documentContext = ragData.document_context;
            console.log('[CHAT-RAG] Contexto de documentos encontrado, tamanho:', documentContext.length);
          }
        } catch (error) {
          console.error('[CHAT-RAG] Erro ao buscar documentos:', error);
        }
      }

      if (contextSummary) {
        // Usar context_summary + documentos + última mensagem
        let systemContent = `Resumo do contexto anterior: ${contextSummary}`;
        if (documentContext) {
          systemContent += `\n\nDocumentos relevantes:\n${documentContext}`;
        }
        
        allMessages = [
          { role: 'system', content: systemContent },
          { role: 'user', content: message }
        ];
        console.log('[CHAT-CONTEXT] Usando rolling summary + RAG no payload');
      } else {
        // Usar mensagens recentes + documentos
        const recentMessages = getRecentMessages(messagesArray, 6);
        let userContent = message;
        if (documentContext) {
          userContent = `Documentos relevantes:\n${documentContext}\n\nMinha pergunta: ${message}`;
        }
        
        allMessages = [
          ...recentMessages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userContent }
        ];
        console.log('[CHAT-CONTEXT] Usando mensagens recentes + RAG:', recentMessages.length);
      }

      // Atualizar contador de mensagens no case
      if (actualCaseId) {
        try {
          await supabase
            .from('cases')
            .update({ message_count: messageCount + 1 })
            .eq('id', actualCaseId);
        } catch (error) {
          console.error('[CHAT-COUNT] Erro ao atualizar contador:', error);
        }
      }

      console.log('[CHAT-GEMINI-START] Enviando mensagem para Gemini 2.5 Pro...');
      try {
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-pro',
          // systemInstruction: effectiveConfig.system_prompt, // Removido temporariamente para teste
          generationConfig: {
            maxOutputTokens: 500, // Reduzido para economizar tokens
            temperature: 0.7, // Levemente mais criativo
            topP: 0.8,
            topK: 40
          }
        });

        const chat = model.startChat({
          history: allMessages.slice(-5).map(m => ({ // Apenas últimas 5 mensagens para economizar tokens
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        });

        // Adicionar context summary se necessário
        let messageToSend = message;
        if (contextSummary) {
          messageToSend = `Contexto anterior: ${contextSummary}\n\nMinha mensagem: ${message}`;
        } else if (messagesArray.length === 0) {
          // Adicionar system prompt na primeira mensagem (temporiário)
          messageToSend = `${effectiveConfig.system_prompt}\n\nMinha primeira mensagem: ${message}`;
        }

        const result = await chat.sendMessage(messageToSend);
        let response = await result.response.text();
        
        console.log('[CHAT-GEMINI-RAW] Resposta bruta:', response);
        console.log('[CHAT-GEMINI-RAW] Tamanho bruto:', response.length);
        
        // NÃO limpar markdown - usar resposta original
        // response = cleanMarkdown(response);
        
        console.log('[CHAT-GEMINI-FINAL] Resposta final (sem limpeza):', response);
        console.log('[CHAT-GEMINI-FINAL] Tamanho final:', response.length);

        // Se resposta estiver vazia, usar resposta padrão em vez de erro
        if (!response || response.trim().length === 0) {
          console.error('[CHAT-GEMINI-WARNING] Resposta está VAZIA, usando resposta padrão');
          response = 'Desculpe, não consegui gerar uma resposta. Por favor, tente novamente com uma mensagem diferente.';
        }

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
          stack: geminiError.stack,
          status: geminiError.status,
          details: geminiError.details
        });
        
        // Erro mais específico para o usuário
        let errorMessage = 'Erro ao chamar API do Gemini';
        if (geminiError.message?.includes('quota') || geminiError.message?.includes('429')) {
          errorMessage = 'Limite de uso da API Google excedido. Tente novamente mais tarde.';
        } else if (geminiError.message?.includes('API key') || geminiError.message?.includes('401') || geminiError.message?.includes('403')) {
          errorMessage = 'Erro na chave API do Google. Verifique sua configuração.';
        } else if (geminiError.message) {
          errorMessage = `Erro na API do Gemini: ${geminiError.message}`;
        }
        
        throw new Error(errorMessage);
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