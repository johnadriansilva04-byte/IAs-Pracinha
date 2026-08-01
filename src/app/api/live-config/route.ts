import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CONFIG } from '@/lib/default-config';

export async function GET(request: NextRequest) {
  try {
    console.log('[LIVE-CONFIG] Buscando configuração para Live API...');

    // Buscar configuração do sistema
    const { data: config, error: configError } = await supabase
      .from('system_config')
      .select('*')
      .single();

    if (configError) {
      console.error('[LIVE-CONFIG-ERROR] Erro ao buscar configuração:', configError);
      console.log('[LIVE-CONFIG-FALLBACK] Usando configuração padrão');
    } else {
      console.log('[LIVE-CONFIG-SUCCESS] Configuração encontrada');
    }

    // Usar configuração do banco ou padrão
    const effectiveConfig = config || DEFAULT_CONFIG;

    // Construir system prompt completo para Live API
    const systemPrompt = `
CARÁTER: ${effectiveConfig.character}

ESTRATÉGIA: ${effectiveConfig.strategy}

RACIOCÍNIO: ${effectiveConfig.reasoning}

${effectiveConfig.system_prompt}

INSTRUÇÕES ESPECIAIS PARA ÁUDIO:
- Você está em uma conversa por voz em tempo real
- Use entonações naturais, pausas e expressividade
- Responda de forma mais conversacional e natural do que em texto
- Quando apropriado, use risadas, exclamações e emoções
- Mantenha respostas relativamente curtas para melhor experiência de voz
- Seja empático e engajado na conversa
    `.trim();

    console.log('[LIVE-CONFIG] System prompt preparado, tamanho:', systemPrompt.length);

    return NextResponse.json({
      success: true,
      systemPrompt,
      config: {
        character: effectiveConfig.character,
        strategy: effectiveConfig.strategy,
        reasoning: effectiveConfig.reasoning
      }
    });

  } catch (error: any) {
    console.error('[LIVE-CONFIG-ERROR] Erro ao processar configuração:', error);
    return NextResponse.json({ 
      error: 'Erro ao buscar configuração',
      details: error.message 
    }, { status: 500 });
  }
}