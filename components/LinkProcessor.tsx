'use client'

import { useState } from 'react'

export default function LinkProcessor() {
  const [links, setLinks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!links.trim()) {
      setMessage('Пожалуйста, введите хотя бы одну ссылку')
      return
    }

    // Парсим ссылки из текста
    const linkArray = links
      .split('\n')
      .map(link => link.trim())
      .filter(link => link.length > 0)

    if (linkArray.length === 0) {
      setMessage('Не найдено валидных ссылок')
      return
    }

    setProcessing(true)
    setMessage(null)

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'links',
          links: linkArray,
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка обработки ссылок')
      }

      const result = await response.json()
      setMessage(`Ссылки успешно обработаны! Обработано: ${result.processedCount} из ${linkArray.length}`)
      setLinks('')
      
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