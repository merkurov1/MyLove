"use client"
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDark(document.documentElement.classList.contains('dark'))
    }
  }, [])

  const toggle = () => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark')
      setDark(document.documentElement.classList.contains('dark'))
    }
  }

  return (
    <button
      onClick={toggle}
      className="ml-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700 transition"
      aria-label={dark ? 'Светлая тема' : 'Тёмная тема'}
      type="button"
    >
      {dark ? '🌙' : '☀️'}
    </button>
  )
}
