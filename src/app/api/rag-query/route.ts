import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);

// Função para gerar embedding usando Gemini
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    return embedding;
  } catch (error) {
    console.error('[RAG] Erro ao gerar embedding:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { case_id, query } = body;

    console.log('[RAG] Iniciando busca RAG:', {
      case_id,
      query_length: query?.length
    });

    if (!query) {
      return NextResponse.json({ error: 'Query é obrigatória' }, { status: 400 });
    }

    // Gerar embedding da query
    const queryEmbedding = await generateEmbedding(query);
    console.log('[RAG] Embedding da query gerado');

    // Buscar documentos relevantes usando função RPC
    const { data: documents, error: matchError } = await supabase
      .rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 3
      });

    if (matchError) {
      console.error('[RAG] Erro ao buscar documentos:', matchError);
      throw matchError;
    }

    console.log('[RAG] Documentos encontrados:', documents?.length || 0);

    // Formatar contexto dos documentos
    const documentContext = documents && documents.length > 0
      ? documents.map((doc: any, index: number) => 
          `[Trecho ${index + 1} - ${doc.document_name}]:\n${doc.content}`
        ).join('\n\n')
      : '';

    console.log('[RAG] Contexto dos documentos montado, tamanho:', documentContext.length);

    return NextResponse.json({ 
      success: true, 
      documents: documents || [],
      document_context: documentContext,
      documents_found: documents?.length || 0
    });

  } catch (error: any) {
    console.error('[RAG] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao buscar documentos relevantes',
      details: error.message 
    }, { status: 500 });
  }
}