import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';

export async function GET() {
  try {
    console.log('[CONFIG] Buscando configuração do sistema...');
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .single();

    if (error) {
      console.error('[CONFIG] Erro ao buscar configuração:', error);
      
      // Se não há configuração, retornar configuração padrão
      if (error.code === 'PGRST116') {
        console.log('[CONFIG] Nenhuma configuração encontrada, retornando padrão');
        return NextResponse.json({
          id: '',
          character: '',
          strategy: '',
          reasoning: '',
          system_prompt: '',
          google_ai_key: '',
          updated_at: new Date().toISOString()
        });
      }
      
      throw error;
    }

    console.log('[CONFIG] Configuração encontrada com sucesso');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[CONFIG] Erro detalhado:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    let errorMessage = 'Erro ao buscar configuração';
    if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela system_config não existe. Execute o SQL do arquivo supabase-setup.sql no painel do Supabase.';
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { character, strategy, reasoning, system_prompt, google_ai_key } = body;

    console.log('[CONFIG] Iniciando atualização da configuração...');
    console.log('[CONFIG] Campos recebidos:', {
      character: !!character,
      strategy: !!strategy,
      reasoning: !!reasoning,
      system_prompt: !!system_prompt,
      google_ai_key: !!google_ai_key
    });

    // Gerar chave única para antiloop
    const antiLoopKey = generateAntiLoopKey('config-update', {
      character,
      strategy,
      reasoning,
      system_prompt
    });

    return await withAntiloop(antiLoopKey, async () => {
      // Primeiro, verificar se já existe configuração
      console.log('[CONFIG] Verificando se configuração existe...');
      const { data: existing, error: existingError } = await supabase
        .from('system_config')
        .select('id')
        .single();

      let result;
      if (existing && !existingError) {
        console.log('[CONFIG] Atualizando configuração existente...');
        result = await supabase
          .from('system_config')
          .update({
            character: character || '',
            strategy: strategy || '',
            reasoning: reasoning || '',
            system_prompt: system_prompt || '',
            google_ai_key: google_ai_key || '',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      } else {
        console.log('[CONFIG] Criando nova configuração...');
        
        // Se tabela não existe, tentar criar
        if (existingError?.message?.includes('does not exist')) {
          console.error('[CONFIG] Tabela não existe:', existingError);
          throw new Error('Tabela system_config não existe. Execute o SQL do arquivo supabase-setup.sql no painel do Supabase.');
        }
        
        result = await supabase
          .from('system_config')
          .insert({
            character: character || '',
            strategy: strategy || '',
            reasoning: reasoning || '',
            system_prompt: system_prompt || '',
            google_ai_key: google_ai_key || ''
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error('[CONFIG] Erro ao salvar configuração:', result.error);
        throw result.error;
      }

      console.log('[CONFIG] Configuração salva com sucesso');
      return NextResponse.json(result.data);
    });
  } catch (error: any) {
    console.error('[CONFIG] Erro detalhado na atualização:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    
    let errorMessage = 'Erro ao atualizar configuração';
    if (error.message?.includes('does not exist')) {
      errorMessage = 'Tabela system_config não existe. Execute o SQL do arquivo supabase-setup.sql no painel do Supabase.';
    } else if (error.message?.includes('row-level security policy')) {
      errorMessage = 'Erro de permissão do Supabase (RLS). Vá ao painel do Supabase > Authentication > Policies e desative o RLS ou adicione políticas para permitir inserção.';
    } else if (error.message?.includes('Operação já em andamento')) {
      errorMessage = 'Já existe uma operação de configuração em andamento. Aguarde alguns segundos.';
    } else if (error.message?.includes('Tempo limite')) {
      errorMessage = 'A operação demorou muito tempo. Tente novamente.';
    } else if (error.code === '23505') {
      errorMessage = 'Erro de duplicação no banco de dados.';
    } else if (error.code === '23502') {
      errorMessage = 'Campo obrigatório não preenchido.';
    } else if (error.code === '23503') {
      errorMessage = 'Erro de chave estrangeira no banco de dados.';
    } else if (error.code === '42501') {
      errorMessage = 'Erro de permissão (RLS) no Supabase. Desative o RLS ou configure políticas corretamente.';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message 
    }, { status: 500 });
  }
}