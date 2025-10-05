'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Source {
  id: string
  name: string
  description?: string
}

interface ChatAssistantProps {
  sources?: Source[]
}

export default function ChatAssistant({ sources = [] }: ChatAssistantProps) {
  const [userInput, setUserInput] = useState('')
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('command-r-plus')
  const [debugInfo, setDebugInfo] = useState<object | null>(null)
  const [sourceId, setSourceId] = useState('')

  const models = [
    { id: 'command-r-plus', name: 'Command R+ (лучший)' },
    { id: 'command-r', name: 'Command R' },
    { id: 'command', name: 'Command' },
    { id: 'base', name: 'Base' }
  ]

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userInput.trim()) return

    const userMessage: Message = { role: 'user', content: userInput }
    setChatHistory(prev => [...prev, userMessage])
    setIsLoading(true)
    setDebugInfo({
      level: 'INFO',
      status: 'Sending request...',
      timestamp: new Date().toISOString(),
      query: userInput,
      model: selectedModel
    })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userInput, model: selectedModel, sourceId })
      })

      // ШАГ 3: Проверяем статус ответа
      setDebugInfo(prev => ({
        ...prev,
        responseStatus: res.status,
        responseHeaders: Object.fromEntries(res.headers.entries()),
        timestamp: new Date().toISOString()
      }))

      // ШАГ 4: Обрабатываем неуспешный ответ сервера
      if (!res.ok) {
        const errorBody = await res.json()
        setDebugInfo({
          level: 'SERVER_ERROR',
          status: res.status,
          body: errorBody,
          timestamp: new Date().toISOString(),
          error: errorBody.error || 'Unknown server error',
          details: errorBody.details || 'No additional details'
        })
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `Ошибка сервера: ${errorBody.error || 'Неизвестная ошибка'}`
        }])
        return
      }

      // ШАГ 5: Обрабатываем успешный ответ
      const data = await res.json()
      setDebugInfo({
        level: 'SUCCESS',
        status: 200,
        message: 'Response received successfully',
        timestamp: new Date().toISOString(),
        responseData: data,
        answerLength: data.answer?.length || 0
      })

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }])

    } catch (err: any) {
      // ШАГ 6: Обрабатываем ошибки клиента (сеть, etc.)
      setDebugInfo({
        level: 'CLIENT_ERROR',
        message: err.message,
        timestamp: new Date().toISOString(),
        error: err.toString(),
        stack: err.stack?.substring(0, 500)
      })

      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Ошибка получения ответа от ассистента.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Чат с AI-ассистентом
            </h2>
            <p className="text-gray-600 mt-1">
              Задавайте вопросы по загруженным данным
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="model-select" className="text-sm font-medium text-gray-700">
              Модель:
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col h-96">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Начните разговор с AI-ассистентом
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2 rounded-lg text-sm bg-gray-100 animate-pulse text-gray-400">AI думает...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4 border-t bg-gray-50">
          <input
            type="text"
            className="flex-1 border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Задайте вопрос..."
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || !userInput.trim()}
          >
            {isLoading ? '...' : 'Отправить'}
          </button>
        </form>

        {/* Отладочная панель */}
        {debugInfo && (
          <div className="mt-4 p-4 bg-gray-100 rounded mx-4 mb-4">
            <h3 className="font-bold text-sm mb-2">Отладочная информация:</h3>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40 bg-white p-2 rounded border">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}