"use client"
import { useState } from 'react'

const MODELS = [
  { label: 'HuggingFace (facebook/bart-base)', value: 'huggingface', dimension: 768 },
  { label: 'OpenAI (text-embedding-ada-002)', value: 'openai', dimension: 1536 },
  { label: 'Cohere (embed-english-light-v2.0)', value: 'cohere', dimension: 1024 },
  { label: 'Ollama (nomic-embed-text)', value: 'ollama', dimension: 768 },
]

export default function SemanticSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [model, setModel] = useState(MODELS[0].value)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResults([])
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model })
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResults(data.results)
    } catch (err) {
      setError('Ошибка поиска')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Семантический поиск</h2>
  <form onSubmit={handleSearch} className="flex gap-4 mb-4 flex-col sm:flex-row w-full max-w-2xl mx-auto">
        <input
          type="text"
          className="flex-1 border rounded px-4 py-2"
          placeholder="Введите поисковый запрос..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          className="border rounded px-4 py-2"
          value={model}
          onChange={e => setModel(e.target.value)}
        >
          {MODELS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700" disabled={loading}>
          {loading ? 'Поиск...' : 'Искать'}
        </button>
      </form>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {/* Skeleton loader */}
      {loading && (
        <ul>
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="mb-4 p-4 border rounded animate-pulse">
              <div className="h-4 w-3/4 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-1/2 mb-1 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
            </li>
          ))}
        </ul>
      )}
      {/* Results */}
      {!loading && (
        <ul>
          {results.map((doc, i) => (
            <li key={doc.id} className="mb-4 p-4 border rounded">
              <div className="text-gray-900 dark:text-gray-100 font-medium mb-1">{doc.content.slice(0, 120)}...</div>
              <div className="text-xs text-gray-500">Похожесть: {doc.similarity?.toFixed(3)}</div>
              <div className="text-xs text-gray-400">{doc.created_at}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
