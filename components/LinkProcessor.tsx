'use client'

import { useState } from 'react'

interface Source {
  id: string
  name: string
  description?: string
}

interface LinkProcessorProps {
  sources: Source[]
}

export default function LinkProcessor({ sources }: LinkProcessorProps) {
  const [links, setLinks] = useState('')
  const [sourceId, setSourceId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!links.trim() || !sourceId) {
      setMessage('Пожалуйста, введите ссылки и выберите источник')
      return
    }

    const linkArray = links
      .split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0)

    if (linkArray.length === 0) {
      setMessage('Не найдено валидных ссылок')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'links',
          links: linkArray,
          sourceId,
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка обработки ссылок')
      }

      const result = await response.json()
      setMessage(`Ссылки успешно обработаны! Обработано: ${result.processedCount} из ${linkArray.length}`)
      setLinks('')
      setSourceId('')
    } catch (error) {
      setMessage('Ошибка при обработке ссылок')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Выберите источник
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Выберите источник</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Введите ссылки (по одной на строку)
        </label>
        <textarea
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={5}
          placeholder="https://example.com&#10;https://another.com"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Обработка...' : 'Обработать ссылки'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </form>
  )
})
      
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Произошла ошибка')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="links-textarea" className="block text-sm font-medium text-gray-700 mb-2">
          Введите ссылки (каждая с новой строки):
        </label>
        <textarea
          id="links-textarea"
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          placeholder="https://example.com/article1
https://youtube.com/watch?v=...
https://example.com/article2"
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="text-sm text-gray-500">
        <p>Поддерживаемые источники:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>YouTube видео (автоматическое извлечение транскрипции)</li>
          <li>Веб-статьи (извлечение основного текста)</li>
        </ul>
      </div>

      <button
        type="submit"
        disabled={!links.trim() || processing}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? 'Обработка...' : 'Обработать ссылки'}
      </button>

      {message && (
        <div className={`border rounded-md p-3 ${
          message.includes('успешно') 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm">{message}</p>
        </div>
      )}
    </form>
  )
}