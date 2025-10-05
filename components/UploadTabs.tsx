"use client"
import { useState } from 'react'

interface Source {
  id: string
  name: string
  description?: string
}

interface UploadTabsProps {
  sources: Source[]
}

export default function UploadTabs({ sources }: UploadTabsProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'links'>('file')
  const [sourceId, setSourceId] = useState<string>('')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Выберите источник
        </label>
        <select
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Выберите источник</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>{source.name}</option>
          ))}
        </select>
      </div>
      <div className="flex mb-6">
        <button
          type="button"
          className={`flex-1 py-2 rounded-l ${activeTab === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          onClick={() => setActiveTab('file')}
        >
          Загрузить файл
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-r ${activeTab === 'links' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          onClick={() => setActiveTab('links')}
        >
          Обработать ссылки
        </button>
      </div>
      <div>
        {activeTab === 'file' ? (
          <FileUploader sources={sources} sourceId={sourceId} setSourceId={setSourceId} />
        ) : (
          <LinkProcessor sources={sources} sourceId={sourceId} setSourceId={setSourceId} />
        )}
      </div>
    </div>
  )
}

// Импортируем компоненты ниже, чтобы избежать циклических импортов
import FileUploader from './FileUploader'
import LinkProcessor from './LinkProcessor'
