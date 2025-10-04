"use client"
import { ToastProvider } from './ToastContext'
import ThemeToggle from './ThemeToggle'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <header className="bg-white dark:bg-gray-950 shadow sticky top-0 z-10">
          <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <a href="/" className="text-xl font-bold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-400 transition">AI-ассистент</a>
            <div className="flex gap-4">
              <a href="/" className="text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-400 px-3 py-1 rounded transition">Главная</a>
              <a href="/documents" className="text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-400 px-3 py-1 rounded transition">Документы</a>
            </div>
            <ThemeToggle />
          </nav>
        </header>
        <main className="pt-4 flex-1">{children}</main>
      </div>
    </ToastProvider>
  )
}
