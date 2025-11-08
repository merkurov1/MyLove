'use client'

import { useState } from 'react'
import { FaLink, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa'

interface Source {
  id: string
  name: string
  description?: string
}

interface LinkProcessorProps {
  sources: Source[]
  sourceId: string
  setSourceId: (id: string) => void
}

type ProcessStatus = 'idle' | 'processing' | 'success' | 'error';

export default function LinkProcessor({ sources, sourceId, setSourceId }: LinkProcessorProps) {
  const [links, setLinks] = useState('')
  const [status, setStatus] = useState<ProcessStatus>('idle')
  const [message, setMessage] = useState<string>('')
  const [results, setResults] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!links.trim() || !sourceId) {
      setStatus('error')
      setMessage('Пожалуйста, введите ссылки и выберите источник')
      return
    }

    const linkArray = links
      .split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0 && (link.startsWith('http://') || link.startsWith('https://')))

    if (linkArray.length === 0) {
      setStatus('error')
      setMessage('Не найдено валидных ссылок (должны начинаться с http:// или https://)')
      return
    }

    setStatus('processing')
    setMessage(`Обработка ${linkArray.length} ссылок...`)
    setResults(null)

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

      const result = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(`Ошибка: ${result.error || 'Неизвестная ошибка'}`)
        setResults(result)
        return
      }

      setStatus('success')
      setMessage(`✓ Успешно обработано ${result.processedCount} из ${linkArray.length} ссылок`)
      setResults(result)
      
      // Очищаем форму через 3 секунды
      setTimeout(() => {
        setLinks('')
        setStatus('idle')
        setMessage('')
        setResults(null)
      }, 5000)
      
    } catch (error: any) {
      setStatus('error')
      setMessage(`✗ Ошибка сети: ${error.message}`)
      console.error('Link processing error:', error)
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <FaSpinner className="animate-spin text-blue-500 text-2xl" />;
      case 'success':
        return <FaCheckCircle className="text-green-500 text-2xl" />;
      case 'error':
        return <FaExclamationCircle className="text-red-500 text-2xl" />;
      default:
        return <FaLink className="text-blue-500 text-2xl" />;
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-2xl">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        {getStatusIcon()}
        Обработка ссылок
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Выберите источник
          </label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            required
            disabled={status === 'processing'}
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Введите ссылки (по одной на строку)
          </label>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm transition"
            rows={6}
            placeholder="https://example.com&#10;https://another.com&#10;https://youtube.com/watch?v=..."
            required
            disabled={status === 'processing'}
          />
          <div className="text-xs text-gray-500 mt-1">
            Поддерживаются веб-страницы и YouTube видео
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'processing'}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center justify-center gap-2"
        >
          {status === 'processing' && <FaSpinner className="animate-spin" />}
          {status === 'processing' ? 'Обрабатываю ссылки...' : 'Обработать ссылки'}
        </button>

        {message && (
          <div className={`p-4 rounded-lg border ${
            status === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : status === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
          }`}>
            <div className="font-medium">{message}</div>
            
            {results && results.results && status === 'success' && (
              <div className="mt-3 space-y-1 text-xs">
                {results.results.map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    {r.success ? (
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                    ) : (
                      <FaExclamationCircle className="text-red-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{r.url}</span>
                    {r.chunksCount && <span className="text-gray-500">({r.chunksCount} чанков)</span>}
                  </div>
                ))}
              </div>
            )}
            
            {results && status === 'error' && (
              <details className="text-xs mt-2">
                <summary className="cursor-pointer">Подробности ошибки</summary>
                <pre className="mt-2 p-2 bg-white dark:bg-gray-900 rounded overflow-auto max-h-40">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
