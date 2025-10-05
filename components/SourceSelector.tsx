'use client'


interface Source {
  id: string
  name: string
  description?: string
}

interface SourceSelectorProps {
  sources: Source[]
  sourceId: string
  setSourceId: (id: string) => void
}

export default function SourceSelector({ sources, sourceId, setSourceId }: SourceSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        Источник
        <span className="text-xs text-gray-400" title="Документы будут привязаны к выбранному источнику">?</span>
      </label>
      <select
        value={sourceId}
        onChange={e => setSourceId(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
      >
        <option value="" disabled>Выберите источник</option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>{source.name}</option>
        ))}
      </select>
    </div>
  )
}