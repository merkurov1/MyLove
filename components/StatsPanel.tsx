"use client"
import { useEffect, useState } from 'react'

export default function StatsPanel() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-8 mb-8 animate-pulse">
      <div className="h-6 w-1/3 mb-4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-4 w-1/4 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/2 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/3 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/4 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  )
  if (!stats) return <div>Нет данных</div>

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Статистика</h2>
      <div className="mb-2">Всего документов: <b>{stats.totalDocs}</b></div>
      <div className="mb-2">По источникам:</div>
      <ul className="mb-2">
        {(Object.entries(stats.sourceCounts) as [string, number][]).map(([src, cnt]) => (
          <li key={src} className="text-sm text-gray-700">{src}: <b>{cnt}</b></li>
        ))}
      </ul>
      <div className="mb-2">По типам контента:</div>
      <ul>
        {(Object.entries(stats.typeCounts) as [string, number][]).map(([type, cnt]) => (
          <li key={type} className="text-sm text-gray-700">{type}: <b>{cnt}</b></li>
        ))}
      </ul>
    </div>
  )
}
