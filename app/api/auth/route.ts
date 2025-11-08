import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    // Проверяем пароль
    if (password === process.env.BASIC_AUTH_PASS) {
      const response = NextResponse.json({ success: true })
      
      // Устанавливаем cookie на 7 дней
      response.cookies.set('auth_password', password, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 7 дней
      })
      
      return response
    }
    
    return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}