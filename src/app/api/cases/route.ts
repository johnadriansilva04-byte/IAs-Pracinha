import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';

export async function GET() {
  try {
    console.log('[CASES] Buscando lista de casos...');
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[CASES] Erro ao buscar casos:', error);
      throw error;
    }

    console.log('[CASES] Casos encontrados:', data?.length || 0);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('[CASES] Erro detalhado:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    let errorMessage = 'Erro ao buscar conversas';
    if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de conversas não existe. Execute o SQL do arquivo supabase-setup.sql.';
    } else if (error.code === 'PGRST116') {
      errorMessage = 'Nenhuma conversa encontrada.';
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;

    console.log('[CASES] Criando novo caso:', { title: !!title });

    // Validação
    if (title !== undefined && typeof title !== 'string') {
      console.error('[CASES] Título inválido');
      return NextResponse.json({ error: 'Título deve ser um texto' }, { status: 400 });
    }

    const antiLoopKey = generateAntiLoopKey('create-case', { title: title || 'Nova Conversa' });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[CASES] Inserindo novo caso no banco...');
      const { data, error } = await supabase
        .from('cases')
        .insert({ title: title?.trim() || 'Nova Conversa' })
        .select()
        .single();

      if (error) {
        console.error('[CASES] Erro ao criar caso:', error);
        throw error;
      }

      console.log('[CASES] Caso criado com sucesso:', data.id);
      return NextResponse.json(data);
    });
  } catch (error: any) {
    console.error('[CASES] Erro detalhado ao criar caso:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    let errorMessage = 'Erro ao criar conversa';
    if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma criação de conversa em andamento. Aguarde.';
    } else if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela de conversas não existe. Execute o SQL do arquivo supabase-setup.sql.';
    } else if (error.code === '23505') {
      errorMessage = 'Já existe uma conversa com esses dados.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}