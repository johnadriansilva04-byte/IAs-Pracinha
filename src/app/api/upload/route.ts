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

    // Converter arquivo para base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Salvar no Supabase
    const { data, error } = await supabase
      .from('document_chunks')
      .insert({
        conversation_id: case_id,
        content: dataUrl,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('[UPLOAD] Erro ao salvar:', error);
      throw error;
    }

    console.log('[UPLOAD] Sucesso:', data.id);

    return NextResponse.json({ 
      success: true, 
      id: data.id,
      fileName: file.name 
    });

  } catch (error: any) {
    console.error('[UPLOAD] Erro detalhado:', error);
    return NextResponse.json({ 
      error: 'Erro ao fazer upload do arquivo',
      details: error.message 
    }, { status: 500 });
  }
}