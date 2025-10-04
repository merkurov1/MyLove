'use client'

import { useState } from 'react'

export default function FileUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Проверка типа файла
      const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown']
      const allowedExtensions = ['.pdf', '.txt', '.md']
      
      const hasValidType = allowedTypes.includes(selectedFile.type) || 
                          allowedExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext))
      
      if (!hasValidType) {
        setMessage('Пожалуйста, выберите файл формата PDF, TXT или MD')
        setFile(null)
        return
      }
      
      setFile(selectedFile)
      setMessage(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setMessage('Пожалуйста, выберите файл')
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'file')

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла')
      }

      const result = await response.json()
      setMessage(`Файл успешно обработан! Создано чанков: ${result.chunksCount}`)
      setFile(null)
      
      // Очистка input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Произошла ошибка')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
          Выберите файл для загрузки:
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".pdf,.txt,.md"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {file && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-green-800 text-sm">
            Выбран файл: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
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