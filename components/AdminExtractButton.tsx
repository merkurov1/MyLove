"use client";
import { useState } from 'react';

export default function AdminExtractButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/extract-columns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 400 }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Request failed');
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <button onClick={run} className="px-4 py-2 bg-green-600 text-white rounded" disabled={loading}>
        {loading ? 'Running...' : 'Extract candidate columns (admin)'}
      </button>

      {error && <div className="mt-3 text-red-500">Error: {error}</div>}

      {result && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 border rounded max-h-96 overflow-auto">
          <div className="text-sm mb-2">Chunks scanned: {result.count_chunks}</div>
          <ol className="list-decimal pl-5 space-y-2">
            {result.titles.map((t: any, i: number) => (
              <li key={t.norm}>
                <div className="font-medium">{t.title} <span className="text-xs text-gray-500">(count: {t.count})</span></div>
                <div className="text-xs text-gray-600 mt-1">Examples:</div>
                <ul className="text-xs text-gray-500 list-disc pl-6">
                  {t.examples.map((ex: any) => (
                    <li key={ex.id}>{ex.preview.substring(0, 160).replace(/\n/g, ' ')}…</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
