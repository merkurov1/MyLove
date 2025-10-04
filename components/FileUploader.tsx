
"use client"
import { useState } from 'react'

interface Source {
  id: string
  name: string
  description?: string
}

interface FileUploaderProps {
  sources: Source[]
}

export default function FileUploader({ sources }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sourceId, setSourceId] = useState<string>('')
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
        formData.append('type', 'file')

        const response = await fetch('/api/process', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error('Ошибка загрузки файла: ' + f.name)

        return response.json()
      }))

      setMessage(`Файлов обработано: ${results.length}. Чанков создано: ${results.map(r => r.chunksCount).join(', ')}`)
      showToast('Файлы успешно загружены и обработаны', 'success')
      setFile(null)
      // Очистка input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Произошла ошибка'
      setMessage(msg)
      showToast(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-2xl mx-auto">
      <div>
        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
          Выберите файл для загрузки:
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {file && Array.isArray(file) && file.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-green-800 text-sm">
            Выбрано файлов: {file.length}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {uploading && <span className="spinner" aria-label="Загрузка" />}
        {uploading ? 'Обработка...' : 'Загрузить файл'}
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