'use client'

import { useState, useEffect } from 'react'
import { supabase, Source } from '@/lib/supabaseClient'

export default function SourceSelector() {
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('name')

      if (error) {
        throw error
      }

      setSources(data || [])
      if (data && data.length > 0) {
        setSelectedSource(data[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки источников')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Ошибка: {error}</p>
        <button
          onClick={fetchSources}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <label htmlFor="source-select" className="block text-sm font-medium text-gray-700">
        Выберите источник данных:
      </label>
      <select
        id="source-select"
        value={selectedSource}
        onChange={(e) => setSelectedSource(e.target.value)}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name} {source.description && `- ${source.description}`}
          </option>
        ))}
      </select>
      
      {sources.length === 0 && (
        <p className="text-gray-500 text-sm">
          Источники данных не найдены. Создайте источник в Supabase.
        </p>
      )}
    </div>
  )
}