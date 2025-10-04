'use client'

import { useState } from 'react'

export default function SourceSelector() {
  const [selectedSource, setSelectedSource] = useState<string>('c5aab739-7112-4360-be9e-45edf4287c42')

  // Временно используем статичные данные вместо запроса к Supabase
  const staticSources = [
    { id: 'c5aab739-7112-4360-be9e-45edf4287c42', name: 'AI Ассистент', description: 'Основной источник данных' },
    { id: 'test-2', name: 'Документация', description: 'Техническая документация' },
    { id: 'test-3', name: 'Веб-статьи', description: 'Статьи из интернета' },
    { id: 'test-4', name: 'YouTube', description: 'Видео транскрипции' }
  ]

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
        {staticSources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name} {source.description && `- ${source.description}`}
          </option>
        ))}
      </select>
      
      <p className="text-sm text-gray-500">
        Выбранный источник: {staticSources.find(s => s.id === selectedSource)?.name}
      </p>
    </div>
  )
}