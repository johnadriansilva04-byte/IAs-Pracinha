import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);

// Função para chunking de texto
function chunkText(text: string, chunkSize: number = 800): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Função para gerar embedding usando Gemini
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    return embedding;
  } catch (error) {
    console.error('[INGEST] Erro ao gerar embedding:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { case_id, document_name, content } = body;

    console.log('[INGEST] Iniciando ingestão de documento:', {
      case_id,
      document_name,
      content_length: content?.length
    });

    if (!content || !document_name) {
      return NextResponse.json({ error: 'Conteúdo e nome do documento são obrigatórios' }, { status: 400 });
    }

    // Chunking do texto
    const chunks = chunkText(content, 800);
    console.log('[INGEST] Documento dividido em', chunks.length, 'chunks');

    // Gerar embeddings e salvar no Supabase
    const savedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        const { data, error } = await supabase
          .from('document_chunks')
          .insert({
            conversation_id: case_id,
            document_name,
            content: chunk,
            embedding: embedding as any, // pgvector aceita array como vector
            metadata: {
              chunk_index: i,
              total_chunks: chunks.length,
              chunk_length: chunk.length
            }
          })
          .select()
          .single();

        if (error) {
          console.error('[INGEST] Erro ao salvar chunk:', error);
          throw error;
        }

        savedChunks.push(data.id);
        console.log('[INGEST] Chunk', i + 1, 'de', chunks.length, 'salvo');
      } catch (error) {
        console.error('[INGEST] Erro no chunk', i, ':', error);
        // Continuar com os próximos chunks mesmo se um falhar
      }
    }

    console.log('[INGEST] Ingestão concluída:', savedChunks.length, 'chunks salvos');

    return NextResponse.json({ 
      success: true, 
      chunks_saved: savedChunks.length,
      document_name
    });

  } catch (error: any) {
    console.error('[INGEST] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar documento',
      details: error.message 
    }, { status: 500 });
  }
}