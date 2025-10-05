"use client"
import { useEffect, useState } from 'react'

interface Doc {
  id: string
  content: string
  metadata: any
  created_at: string
  source_id: string
  embedding_provider: string
  source_name?: string // for UI only, not from DB
}

export default function DocumentsTable() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Optionally, fetch sources for mapping source_id to name
  const [sources, setSources] = useState<{id: string, name: string}[]>([])

  const fetchDocs = async () => {
      setLoading(true)
      setError('')
      try {
        const [docsRes, sourcesRes] = await Promise.all([
          fetch('/api/documents'),
          fetch('/api/sources')
        ])
        if (!docsRes.ok) {
          const err = await docsRes.json()
          setError(err.error || 'Ошибка доступа к документам')
          setDocs([])
          return
        }
        const docsData = await docsRes.json()
        const sourcesData = sourcesRes.ok ? await sourcesRes.json() : { sources: [] }
        if (docsData.error) setError(docsData.error)
        else {
          setDocs(docsData.docs.map((doc: Doc) => ({
            ...doc,
            source_name: sourcesData.sources?.find((s: any) => s.id === doc.source_id)?.name || doc.source_id
          })))
        }
        if (sourcesData.sources) setSources(sourcesData.sources)
      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки документов')
      } finally {
        setLoading(false)
      }
  }

  useEffect(() => { fetchDocs() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить документ?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.error) setDocs(docs => docs.filter(d => d.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Список документов</h2>
      {loading && (
        <div>
          <div className="h-6 w-1/3 mb-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Текст</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Источник</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm sm:text-base">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Текст</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Источник</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
              <th className="px-2 sm:px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {docs.map(doc => (
              <tr key={doc.id} className="hover:bg-blue-50 transition">
                <td className="px-2 sm:px-4 py-2 max-w-xs truncate text-gray-900">{doc.content.slice(0, 120)}...</td>
                <td className="px-2 sm:px-4 py-2 text-xs text-gray-500">{doc.source_name} <br /> <span className="text-gray-400">{doc.metadata?.filename || doc.metadata?.url || '—'}</span></td>
                <td className="px-2 sm:px-4 py-2 text-xs text-gray-400">{doc.created_at?.slice(0, 19).replace('T', ' ')}</td>
                <td className="px-2 sm:px-4 py-2">
                  <button
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                    disabled={deleting === doc.id}
                    onClick={() => handleDelete(doc.id)}
                  >
                    {deleting === doc.id ? 'Удаление...' : 'Удалить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
