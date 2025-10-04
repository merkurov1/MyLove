import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Временно отключаем Basic Auth для упрощения тестирования
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}