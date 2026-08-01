import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/api/login', '/api/signup', '/api/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  // Não verificar autenticação para rotas públicas
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Para outras rotas, deixar o frontend decidir
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};