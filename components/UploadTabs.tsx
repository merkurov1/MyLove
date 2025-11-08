"use client"
import { useState, useEffect } from 'react'

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

  // Если sources появились и sourceId не выбран, выбрать первый источник
  useEffect(() => {
    if (sources.length > 0 && !sourceId) {
      setSourceId(sources[0].id)
    }
  }, [sources])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Загрузка документов</h2>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          Выберите источник
          <span className="text-xs text-gray-400" title="Документы будут привязаны к выбранному источнику">?</span>
        </label>
        {sources.length === 0 ? (
          <div className="text-gray-400 italic">Нет доступных источников</div>
        ) : (
          <select
            value={sourceId}
            onChange={e => setSourceId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>{source.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex mb-6 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
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
          <FileUploader sourceId={sourceId} />
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
