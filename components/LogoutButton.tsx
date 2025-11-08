"use client"
import { useAuth } from './PasswordProtection'
import { FaSignOutAlt } from 'react-icons/fa'

export default function LogoutButton() {
  const { logout } = useAuth()

  return (
    <button
      onClick={logout}
      className="px-3 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50 transition flex items-center gap-2 text-sm"
      aria-label="Выйти"
      type="button"
      title="Выйти из системы"
    >
      <FaSignOutAlt />
      <span className="hidden sm:inline">Выйти</span>
    </button>
  )
}
