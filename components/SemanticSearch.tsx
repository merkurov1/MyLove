"use client"
import { useState } from 'react'

export default function SemanticSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResults([])
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl mx-auto mb-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Семантический поиск</h2>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          placeholder="Введите запрос..."
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
        >
          Искать
        </button>
      </form>
      {loading && <div className="flex items-center gap-2 text-blue-500 mb-2"><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Поиск...</div>}
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <div className="space-y-4">
        {results.length === 0 && !loading && !error && <div className="text-gray-400 text-center">Нет результатов</div>}
        {results.map((res, idx) => (
          <div key={idx} className="bg-gray-100 dark:bg-gray-900 rounded p-4 shadow">
            <div className="text-gray-900 dark:text-gray-100 mb-2">{res.content}</div>
            <div className="text-xs text-gray-500">Источник: {res.source_name || res.source_id}</div>
            <div className="text-xs text-gray-400">Сходство: {(res.similarity * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
