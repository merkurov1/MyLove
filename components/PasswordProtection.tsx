'use client'
import { useState, useEffect } from 'react'

const PASSWORD = 'eMunwiL' // Измените на свой пароль

export default function PasswordProtection({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Проверяем, был ли пользователь уже аутентифицирован
    const authStatus = localStorage.getItem('isAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem('isAuthenticated', 'true')
      setError('')
    } else {
      setError('Неверный пароль')
      setPassword('')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('isAuthenticated')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Вход в систему
            </h1>
            <p className="text-gray-600">
              Введите пароль для доступа
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Введите пароль"
                required
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
        <span className="text-sm">Админ-панель</span>
        <button
          onClick={handleLogout}
          className="text-sm hover:text-gray-300 underline"
        >
          Выйти
        </button>
      </div>
      {children}
    </div>
  )
}