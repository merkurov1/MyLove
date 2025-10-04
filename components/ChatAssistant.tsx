'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatAssistant() {
  const [userInput, setUserInput] = useState('')
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userInput.trim()) return
    const userMessage: Message = { role: 'user', content: userInput }
    setChatHistory(prev => [...prev, userMessage])
    setUserInput('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userInput })
      })
      const data = await res.json()
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Ошибка получения ответа от ассистента.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-semibold text-gray-800">
          Чат с AI-ассистентом
        </h2>
        <p className="text-gray-600 mt-1">
          Задавайте вопросы по загруженным данным
        </p>
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
      </div>
    </div>
  )
}