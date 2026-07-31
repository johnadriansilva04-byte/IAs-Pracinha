import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { case_id, messages } = body;

    console.log('[SAVE] Iniciando salvamento de conversa:', {
      case_id: !!case_id,
      messages_count: messages?.length
    });

    // Validação
    if (!case_id) {
      console.error('[SAVE] case_id não fornecido');
      return NextResponse.json({ error: 'ID da conversa (case_id) é obrigatório' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      console.error('[SAVE] messages inválido');
      return NextResponse.json({ error: 'Mensagens devem ser um array válido' }, { status: 400 });
    }

    if (messages.length === 0) {
      console.error('[SAVE] array de mensagens vazio');
      return NextResponse.json({ error: 'Nenhuma mensagem para salvar' }, { status: 400 });
    }

    // Validar estrutura das mensagens
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.role || !msg.content) {
        console.error(`[SAVE] Mensagem ${i} inválida:`, msg);
        return NextResponse.json({ 
          error: `Mensagem ${i + 1} inválida. Cada mensagem deve ter 'role' e 'content'` 
        }, { status: 400 });
      }
      
      if (!['user', 'assistant'].includes(msg.role)) {
        console.error(`[SAVE] Role inválido na mensagem ${i}:`, msg.role);
        return NextResponse.json({ 
          error: `Role da mensagem ${i + 1} deve ser 'user' ou 'assistant'` 
        }, { status: 400 });
      }
    }

    // Gerar chave única para antiloop
    const antiLoopKey = generateAntiLoopKey('save-conversation', {
      case_id,
      messages_count: messages.length
    });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[SAVE] Salvando mensagens no banco de dados...');
      
      let savedCount = 0;
      let errors = [];

      // Salvar todas as mensagens
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        try {
          const { error: insertError } = await supabase.from('messages').insert({
            case_id,
            role: message.role,
            content: message.content
          });

          if (insertError) {
            console.error(`[SAVE] Erro ao salvar mensagem ${i}:`, insertError);
            errors.push(`Mensagem ${i + 1}: ${insertError.message}`);
          } else {
            savedCount++;
          }
        } catch (err: any) {
          console.error(`[SAVE] Exceção ao salvar mensagem ${i}:`, err);
          errors.push(`Mensagem ${i + 1}: ${err.message}`);
        }
      }

      console.log('[SAVE] Mensagens salvas:', savedCount, 'Erros:', errors.length);

      // Atualizar timestamp do caso
      try {
        await supabase
          .from('cases')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', case_id);
        console.log('[SAVE] Timestamp do caso atualizado');
      } catch (error) {
        console.error('[SAVE] Erro ao atualizar timestamp:', error);
      }

      if (errors.length > 0) {
        return NextResponse.json({ 
          success: true, 
          count: savedCount,
          errors,
          warning: 'Algumas mensagens não foram salvas'
        }, { status: 207 }); // Multi-status
      }

      console.log('[SAVE] Conversa salva com sucesso');
      return NextResponse.json({ success: true, count: savedCount });
    });
  } catch (error: any) {
    console.error('[SAVE] Erro detalhado:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    
    let errorMessage = 'Erro ao salvar conversa';
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe um salvamento em andamento. Aguarde a conclusão.';
    } else if (error.message?.includes('Tempo limite')) {
      errorMessage = 'O salvamento demorou muito tempo. Tente novamente.';
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de mensagens não existe. Execute o SQL do arquivo supabase-setup.sql.';
    } else if (error.code === '23503') {
      errorMessage = 'Conversa (case) não encontrada. Verifique se o ID está correto.';
    } else if (error.code === '23502') {
      errorMessage = 'Campo obrigatório não preenchido nas mensagens.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}