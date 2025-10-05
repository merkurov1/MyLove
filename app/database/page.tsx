"use client"
import StatsPanel from '@/components/StatsPanel'
import SemanticSearch from '@/components/SemanticSearch'
import UploadTabs from '@/components/UploadTabs'
import DocumentsTable from '@/components/DocumentsTable'
import { useState, useEffect } from 'react'

export default function DatabasePanel() {
  // Пример загрузки sources из Supabase (можно заменить на серверный fetch или getServerSideProps)
  const [sources, setSources] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/sources')
      .then(res => res.json())
      .then(data => setSources(data.sources || []))
  }, [])

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8">
      <StatsPanel />
      <SemanticSearch />
      <UploadTabs sources={sources} />
      <DocumentsTable />
    </div>
  )
}
