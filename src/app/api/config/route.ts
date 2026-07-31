import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAntiloop, generateAntiLoopKey } from '@/lib/antiloop';

export async function GET() {
  try {
    console.log('[CONFIG] Buscando configurações do sistema...');
    const { data, error } = await supabase
      .from('system_config')
      .select('id, character, strategy, reasoning, system_prompt, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

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
          updated_at: new Date().toISOString()
        });
      }
      
      throw error;
    }

    // Retornar a configuração mais recente
    const latestConfig = data && data.length > 0 ? data[0] : {
      id: '',
      character: '',
      strategy: '',
      reasoning: '',
      system_prompt: '',
      updated_at: new Date().toISOString()
    };

    console.log('[CONFIG] Configuração encontrada com sucesso');
    return NextResponse.json(latestConfig);
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
    const { character, strategy, reasoning, system_prompt, mode } = body;

    console.log('[CONFIG] Iniciando atualização da configuração...');
    console.log('[CONFIG] Campos recebidos:', {
      character: !!character,
      strategy: !!strategy,
      reasoning: !!reasoning,
      system_prompt: !!system_prompt,
      mode: mode || 'replace'
    });

    // Se mode = 'new', sempre cria nova configuração
    // Se mode = 'replace' ou undefined, substitui a existente
    if (mode === 'new') {
      console.log('[CONFIG] Criando nova configuração...');
      const result = await supabase
        .from('system_config')
        .insert({
          character: character || '',
          strategy: strategy || '',
          reasoning: reasoning || '',
          system_prompt: system_prompt || ''
        })
        .select()
        .single();

      if (result.error) {
        console.error('[CONFIG] Erro ao criar nova configuração:', result.error);
        throw result.error;
      }

      console.log('[CONFIG] Nova configuração criada com sucesso');
      return NextResponse.json(result.data);
    }

    // mode = 'replace' (padrão)
    const antiLoopKey = generateAntiLoopKey('config-update', {
      character,
      strategy,
      reasoning,
      system_prompt
    });

    return await withAntiloop(antiLoopKey, async () => {
      console.log('[CONFIG] Verificando se configuração existe...');
      const { data: existing, error: existingError } = await supabase
        .from('system_config')
        .select('id')
        .single();

      let result;
      if (existing && !existingError) {
        console.log('[CONFIG] Substituindo configuração existente...');
        result = await supabase
          .from('system_config')
          .update({
            character: character || '',
            strategy: strategy || '',
            reasoning: reasoning || '',
            system_prompt: system_prompt || '',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      } else {
        console.log('[CONFIG] Criando primeira configuração...');
        
        if (existingError?.message?.includes('does not exist')) {
          console.error('[CONFIG] Tabela não existe:', existingError);
          throw new Error('Tabela system_config não existe. Execute o SQL do arquivo supabase-reset.sql no painel do Supabase.');
        }
        
        result = await supabase
          .from('system_config')
          .insert({
            character: character || '',
            strategy: strategy || '',
            reasoning: reasoning || '',
            system_prompt: system_prompt || ''
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
      errorMessage = 'Tabela system_config não existe. Execute o SQL do arquivo supabase-reset.sql no painel do Supabase.';
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