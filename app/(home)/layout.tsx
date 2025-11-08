"use client"
import ClientProviders from '@/components/ClientProviders'
import Sidebar from '@/components/Sidebar'

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <ClientProviders>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 flex flex-col items-center p-4 overflow-auto">{children}</main>
        </div>
      </ClientProviders>
    </div>
  )
}
