import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Авторизация временно отключена
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)'],
}