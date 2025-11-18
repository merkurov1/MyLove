"use client"
import ClientProviders from '@/components/ClientProviders'
import Sidebar from '@/components/Sidebar'
import { useState } from 'react'

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <ClientProviders>
        <div className="flex min-h-screen">
          <Sidebar isCollapsed={isCollapsed} onToggleCollapse={setIsCollapsed} />
          <main className={`flex-1 flex flex-col items-center p-4 overflow-auto transition-all duration-300 ml-0 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
            {children}
          </main>
        </div>
      </ClientProviders>
    </div>
  )
}
