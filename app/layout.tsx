import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientProviders from '../components/ClientProviders'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Панель управления AI-ассистентом',
  description: 'Интерфейс для загрузки и обработки данных в векторную базу данных',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="ru" className="dark">
      <body className={inter.className + ' bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100'}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}