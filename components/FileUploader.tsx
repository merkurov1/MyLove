"use client"
import { useState } from 'react'

interface Source {
  id: string
  name: string
  description?: string
}

interface FileUploaderProps {
  sources: Source[]
  sourceId: string
  setSourceId: (id: string) => void
}

export default function FileUploader({ sources, sourceId, setSourceId }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !sourceId) {
      setMessage('Пожалуйста, выберите файл и источник')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'file')
      formData.append('sourceId', sourceId)

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла')
      }

      const result = await response.json()
      setMessage(`Файл успешно обработан! Чанков: ${result.totalChunks}`)
      setFile(null)
      setSourceId('')
    } catch (error) {
      setMessage('Ошибка при загрузке файла')
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
          Выберите файл
        </label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          accept=".pdf,.txt,.md"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Загрузка...' : 'Загрузить файл'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </form>
  )
}
