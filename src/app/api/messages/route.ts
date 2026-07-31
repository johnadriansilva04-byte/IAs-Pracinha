import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';

export async function GET(request: NextRequest) {
  try {
    console.log('[MESSAGES] Buscando mensagens...');
    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('case_id');

    if (!caseId) {
      console.error('[MESSAGES] case_id não fornecido');
      return NextResponse.json({ error: 'ID da conversa (case_id) é obrigatório' }, { status: 400 });
    }

    console.log('[MESSAGES] Buscando mensagens do case:', caseId);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MESSAGES] Erro ao buscar mensagens:', error);
      throw error;
    }

    console.log('[MESSAGES] Mensagens encontradas:', data?.length || 0);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('[MESSAGES] Erro detalhado:', {
      message: error.message,
      code: error.code,
      details: error.details
    });
    
    let errorMessage = 'Erro ao buscar mensagens';
    if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de mensagens não existe. Execute o SQL do arquivo supabase-reset.sql.';
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { case_id, role, content, compressed_summary } = body;

    console.log('[MESSAGES] Criando nova mensagem:', {
      case_id: !!case_id,
      role,
      content_length: content?.length
    });

    // Validação
    if (!case_id) {
      console.error('[MESSAGES] case_id não fornecido');
      return NextResponse.json({ error: 'ID da conversa (case_id) é obrigatório' }, { status: 400 });
    }

    if (!role || !['user', 'assistant'].includes(role)) {
      console.error('[MESSAGES] role inválido:', role);
      return NextResponse.json({ error: 'Role deve ser "user" ou "assistant"' }, { status: 400 });
    }

    if (!content || typeof content !== 'string') {
      console.error('[MESSAGES] content inválido');
      return NextResponse.json({ error: 'Conteúdo da mensagem é obrigatório' }, { status: 400 });
    }

    const antiLoopKey = generateAntiLoopKey('create-message', { case_id, role });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[MESSAGES] Inserindo mensagem no banco...');
      const { data, error } = await supabase
        .from('messages')
        .insert({ case_id, role, content, compressed_summary })
        .select()
        .single();

      if (error) {
        console.error('[MESSAGES] Erro ao criar mensagem:', error);
        throw error;
      }

      // Atualizar timestamp do caso
      try {
        await supabase
          .from('cases')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', case_id);
        console.log('[MESSAGES] Timestamp do caso atualizado');
      } catch (updateError) {
        console.error('[MESSAGES] Erro ao atualizar timestamp (não crítico):', updateError);
      }

      console.log('[MESSAGES] Mensagem criada com sucesso');
      return NextResponse.json(data);
    });
  } catch (error: any) {
    console.error('[MESSAGES] Erro detalhado ao criar:', {
      message: error.message,
      code: error.code,
      details: error.details
    });
    
    let errorMessage = 'Erro ao criar mensagem';
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma criação de mensagem em andamento. Aguarde.';
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de mensagens não existe. Execute o SQL do arquivo supabase-reset.sql.';
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}