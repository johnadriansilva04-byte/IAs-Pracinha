import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    console.log('[CASES] Deletando caso:', caseId);

    if (!caseId) {
      console.error('[CASES] ID não fornecido');
      return NextResponse.json({ error: 'ID da conversa é obrigatório' }, { status: 400 });
    }

    const antiLoopKey = generateAntiLoopKey('delete-case', { id: caseId });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[CASES] Executando delete no banco...');
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', caseId);

      if (error) {
        console.error('[CASES] Erro ao deletar caso:', error);
        throw error;
      }

      console.log('[CASES] Caso deletado com sucesso');
      return NextResponse.json({ success: true });
    });
  } catch (error: any) {
    console.error('[CASES] Erro detalhado ao deletar:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    let errorMessage = 'Erro ao deletar conversa';
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma operação de deleção em andamento. Aguarde.';
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de conversas não existe.';
    } else if (error.code === 'PGRST116') {
      errorMessage = 'Conversa não encontrada.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const body = await request.json();
    const { title } = body;

    console.log('[CASES] Atualizando caso:', { id: caseId, title: !!title });

    if (!caseId) {
      console.error('[CASES] ID não fornecido');
      return NextResponse.json({ error: 'ID da conversa é obrigatório' }, { status: 400 });
    }

    if (title !== undefined && typeof title !== 'string') {
      console.error('[CASES] Título inválido');
      return NextResponse.json({ error: 'Título deve ser um texto' }, { status: 400 });
    }

    const antiLoopKey = generateAntiLoopKey('update-case', { id: caseId, title });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[CASES] Executando update no banco...');
      const { data, error } = await supabase
        .from('cases')
        .update({ 
          title: title?.trim() || 'Nova Conversa',
          updated_at: new Date().toISOString() 
        })
        .eq('id', caseId)
        .select()
        .single();

      if (error) {
        console.error('[CASES] Erro ao atualizar caso:', error);
        throw error;
      }

      console.log('[CASES] Caso atualizado com sucesso');
      return NextResponse.json(data);
    });
  } catch (error: any) {
    console.error('[CASES] Erro detalhado ao atualizar:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    let errorMessage = 'Erro ao atualizar conversa';
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma atualização em andamento. Aguarde.';
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de conversas não existe.';
    } else if (error.code === 'PGRST116') {
      errorMessage = 'Conversa não encontrada.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}