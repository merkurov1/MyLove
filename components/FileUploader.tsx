
"use client"
import { useState } from 'react'
import { useToast } from './ToastContext'

export default function FileUploader() {
  const [file, setFile] = useState<File | File[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown']
      const allowedExtensions = ['.pdf', '.txt', '.md']
      const validFiles: File[] = []
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const hasValidType = allowedTypes.includes(file.type) || 
          allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        if (hasValidType) validFiles.push(file)
      }
      if (validFiles.length === 0) {
        setMessage('Пожалуйста, выберите файлы формата PDF, TXT или MD')
        showToast('Пожалуйста, выберите файлы формата PDF, TXT или MD', 'error')
        setFile(null)
        return
      }
      setFile(validFiles as any)
      setMessage(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setMessage('Пожалуйста, выберите файл(ы)')
      showToast('Пожалуйста, выберите файл(ы)', 'error')
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const files = Array.isArray(file) ? file : [file]
      const results = await Promise.all(files.map(async (f) => {
        const formData = new FormData()
        formData.append('file', f)
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