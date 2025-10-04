"use client"
import { useEffect } from 'react'

export interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div className={`fixed z-50 bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-lg text-white text-sm font-medium transition bg-opacity-90
      ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}
      role="alert"
    >
      {message}
    </div>
  )
}
