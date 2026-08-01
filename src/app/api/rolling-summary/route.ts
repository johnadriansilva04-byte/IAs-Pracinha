import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);

async function generateSummary(messages: any[]): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.5
      }
    });

    const messagesText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Resuma as seguintes mensagens de conversa em no máximo 3 tópicos essenciais para manter o contexto do usuário. Seja conciso e direto:\n\n${messagesText}`;

    const result = await model.generateContent(prompt);
    const summary = await result.response.text();
    
    // Limpar markdown do resumo
    return summary
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^- /gm, '')
      .replace(/^\d+\.\s/gm, '')
      .trim();
  } catch (error) {
    console.error('[ROLLING-SUMMARY] Erro ao gerar resumo:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { case_id } = body;

    console.log('[ROLLING-SUMMARY] Iniciando rolling summary para case:', case_id);

    // Buscar as últimas 10 mensagens
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('case_id', case_id)
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) {
      console.error('[ROLLING-SUMMARY] Erro ao buscar mensagens:', messagesError);
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      console.log('[ROLLING-SUMMARY] Nenhuma mensagem para resumir');
      return NextResponse.json({ success: true, summary: '' });
    }

    console.log('[ROLLING-SUMMARY] Mensagens para resumir:', messages.length);

    // Gerar resumo
    const summary = await generateSummary(messages);
    console.log('[ROLLING-SUMMARY] Resumo gerado:', summary);

    // Buscar resumo atual do case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('context_summary')
      .eq('id', case_id)
      .single();

    if (caseError) {
      console.error('[ROLLING-SUMMARY] Erro ao buscar case:', caseError);
      throw caseError;
    }

    // Atualizar resumo (concatenar com resumo anterior)
    const currentSummary = caseData?.context_summary || '';
    const newSummary = currentSummary 
      ? `${currentSummary}\n\n${summary}` 
      : summary;

    // Atualizar case com novo resumo e zerar contador
    const { error: updateError } = await supabase
      .from('cases')
      .update({ 
        context_summary: newSummary,
        message_count: 0 
      })
      .eq('id', case_id);

    if (updateError) {
      console.error('[ROLLING-SUMMARY] Erro ao atualizar case:', updateError);
      throw updateError;
    }

    // Deletar as 10 mensagens processadas
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .in('id', messages.map(m => m.id));

    if (deleteError) {
      console.error('[ROLLING-SUMMARY] Erro ao deletar mensagens:', deleteError);
      throw deleteError;
    }

    console.log('[ROLLING-SUMMARY] Mensagens deletadas:', messages.length);

    return NextResponse.json({ 
      success: true, 
      summary: newSummary,
      messagesDeleted: messages.length
    });

  } catch (error: any) {
    console.error('[ROLLING-SUMMARY] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao gerar rolling summary',
      details: error.message 
    }, { status: 500 });
  }
}