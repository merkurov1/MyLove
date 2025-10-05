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
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-900 p-6 rounded-lg shadow">
      <label className="block text-sm font-medium text-gray-700 mb-2">Файл для загрузки</label>
      <input
        type="file"
        onChange={e => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        placeholder="Выберите файл..."
      />
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Загрузка...</span>
        ) : 'Загрузить'}
      </button>
      {message && <div className={`text-sm ${message.includes('успешно') ? 'text-green-600' : 'text-red-500'}`}>{message}</div>}
    </form>
  )
}
