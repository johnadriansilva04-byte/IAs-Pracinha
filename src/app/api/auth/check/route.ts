import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = request.cookies.get('session');
  
  console.log('[AUTH-CHECK] Verificando autenticação:', { hasSession: !!session });
  
  return NextResponse.json({ 
    authenticated: !!session 
  });
}