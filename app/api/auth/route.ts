import { NextResponse } from 'next/server'

export async function GET() {
  return new NextResponse('Требуется аутентификация', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Панель управления AI-ассистентом"',
    },
  })
}