"use client";
import { useState, useEffect } from 'react';

interface TunerSettings {
  requireSources: boolean;
  preferExtractive: boolean;
  cacheThreshold: number;
  maxGenerationTokens: number;
  sourceFilter: string;
}

const DEFAULTS: TunerSettings = {
  requireSources: false,
  preferExtractive: false,
  cacheThreshold: 0.99,
  maxGenerationTokens: 1500,
  sourceFilter: ''
};

export default function ResponseTuner({
  settings,
  onChange,
  onClose
}: {
  settings?: Partial<TunerSettings>;
  onChange: (s: TunerSettings) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<TunerSettings>({ ...DEFAULTS, ...(settings || {}) });

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('responseTuner') : null;
    if (stored) {
      try {
        setLocal(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const apply = () => {
    localStorage.setItem('responseTuner', JSON.stringify(local));
    onChange(local);
    onClose();
  };

  const reset = () => {
    setLocal(DEFAULTS);
    localStorage.removeItem('responseTuner');
    onChange(DEFAULTS);
  };

  return (
    <div className="absolute top-16 right-4 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Настройки ответов</h3>
        <button onClick={onClose} className="text-sm text-gray-500">Закрыть</button>
      </div>

      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between">
          <span>Требовать источники</span>
          <input type="checkbox" checked={local.requireSources} onChange={(e) => setLocal({ ...local, requireSources: e.target.checked })} />
        </label>

        <label className="flex items-center justify-between">
          <span>Предпочитать извлечение (extractive)</span>
          <input type="checkbox" checked={local.preferExtractive} onChange={(e) => setLocal({ ...local, preferExtractive: e.target.checked })} />
        </label>

        <div>
          <div className="mb-1">Порог кеша (similarity)</div>
          <input type="range" min="0.9" max="0.999" step="0.001" value={local.cacheThreshold} onChange={(e) => setLocal({ ...local, cacheThreshold: parseFloat(e.target.value) })} />
          <div className="text-xs text-gray-500">{local.cacheThreshold.toFixed(3)}</div>
        </div>

        <div>
          <div className="mb-1">Макс токенов для генерации</div>
          <input type="number" className="w-full p-2 border rounded" value={local.maxGenerationTokens} onChange={(e) => setLocal({ ...local, maxGenerationTokens: Math.max(128, Math.min(32000, Number(e.target.value) || 1500)) })} />
        </div>

        <div>
          <div className="mb-1">Фильтр источников (через запятую, optional)</div>
          <input type="text" className="w-full p-2 border rounded" value={local.sourceFilter} onChange={(e) => setLocal({ ...local, sourceFilter: e.target.value })} placeholder="novayagazeta.ru, docs.example.com" />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button onClick={apply} className="px-3 py-2 bg-blue-600 text-white rounded">Применить</button>
          <button onClick={reset} className="px-3 py-2 border rounded">Сбросить</button>
        </div>
      </div>
    </div>
  );
}
