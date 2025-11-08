import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pierrot AI - Интеллект, Раскрывающий Текст',
  description: 'Персональный AI-ассистент для глубокого анализа текстов, психолингвистических исследований и профессиональной работы с документами.',
}

export default function AILayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
