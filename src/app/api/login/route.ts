import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Criar sessão simples
    const response = NextResponse.json({ 
      success: true, 
      user: data.user 
    });

    // Set cookie simples
    response.cookies.set('session', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 dias
    });

    return response;
  } catch (error: any) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json({ 
      error: 'Erro ao fazer login' 
    }, { status: 500 });
  }
}