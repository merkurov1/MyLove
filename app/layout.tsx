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
      <body className={inter.className + " bg-gray-100 dark:bg-gray-900 min-h-screen"}>
        <ClientProviders>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6 overflow-auto">{children}</main>
          </div>
        </ClientProviders>
      </body>
    </html>
  )
}