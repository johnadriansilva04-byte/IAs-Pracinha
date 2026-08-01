import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      user: data.user,
      message: 'Conta criada com sucesso! Você pode fazer login agora.'
    });
  } catch (error: any) {
    console.error('Erro ao criar conta:', error);
    return NextResponse.json({ 
      error: 'Erro ao criar conta' 
    }, { status: 500 });
  }
}