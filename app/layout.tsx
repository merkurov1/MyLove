import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientProviders from '../components/ClientProviders'
import Sidebar from '../components/Sidebar'

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
    <html lang="ru">
      <body className={inter.className + " min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900"}>
        <ClientProviders>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col items-center pt-10 md:pt-16 px-2 md:px-8 overflow-auto">{children}</main>
          </div>
        </ClientProviders>
      </body>
    </html>
  )
}