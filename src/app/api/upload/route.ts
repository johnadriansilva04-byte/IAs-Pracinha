import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const case_id = formData.get('case_id') as string;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }

    if (!case_id) {
      return NextResponse.json({ error: 'ID da conversa não fornecido' }, { status: 400 });
    }

    console.log('[UPLOAD] Iniciando upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      case_id
    });

    // Validar tamanho (limite 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Arquivo muito grande. Máximo 50MB.' 
      }, { status: 400 });
    }

    // Validar tipo MIME (focar em documentos textuais para RAG)
    const allowedTypes = [
      // Documentos textuais para RAG
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'text/markdown',
      'text/csv'
    ];

    console.log('[UPLOAD] Tipo do arquivo:', file.type);
    console.log('[UPLOAD] Tipos permitidos:', allowedTypes);

    if (!allowedTypes.includes(file.type)) {
      console.error('[UPLOAD] Tipo não permitido:', file.type);
      return NextResponse.json({ 
        error: `Tipo de arquivo não suportado para RAG: ${file.type}. Use PDF, DOC, DOCX ou TXT.` 
      }, { status: 400 });
    }

    // Extrair texto do arquivo
    let textContent = '';
    if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'text/csv') {
      const bytes = await file.arrayBuffer();
      textContent = Buffer.from(bytes).toString('utf-8');
    } else {
      // Para PDF e DOC, salvar base64 para processamento futuro
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      textContent = base64; // Placeholder para processamento posterior
    }

    // Enviar para ingestão RAG
    const ingestResponse = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id,
        document_name: file.name,
        content: textContent
      })
    });

    const ingestData = await ingestResponse.json();

    if (!ingestData.success) {
      throw new Error(ingestData.error || 'Erro na ingestão do documento');
    }

    console.log('[UPLOAD] Ingestão RAG concluída:', ingestData.chunks_saved, 'chunks');

    return NextResponse.json({ 
      success: true, 
      document_name: file.name,
      chunks_saved: ingestData.chunks_saved
    });

  } catch (error: any) {
    console.error('[UPLOAD] Erro detalhado:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar documento para RAG',
      details: error.message 
    }, { status: 500 });
  }
}