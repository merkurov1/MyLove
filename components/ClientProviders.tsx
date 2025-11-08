"use client"
import { ToastProvider } from './ToastContext'
import ThemeToggle from './ThemeToggle'
import LogoutButton from './LogoutButton'
import PasswordProtection from './PasswordProtection'
import ErrorBoundary from './ErrorBoundary'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <PasswordProtection>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white dark:bg-gray-950 shadow sticky top-0 z-20">
            <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <a href="/" className="flex items-center gap-2 text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight hover:text-blue-900 dark:hover:text-blue-400 transition">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#2563eb"/><path d="M7 17V7h2.5c2.5 0 4.5 1.5 4.5 5s-2 5-4.5 5H7Zm2-2h.5c1.5 0 2.5-1 2.5-3s-1-3-2.5-3H9v6Z" fill="#fff"/></svg>
                  <span>Pierrot AI</span>
                </a>
              </div>
              <div className="flex gap-2 sm:gap-4 items-center">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </nav>
          </header>
          <main className="pt-4 flex-1">{children}</main>
        </div>
      </PasswordProtection>
    </ToastProvider>
    </ErrorBoundary>
  )
}
