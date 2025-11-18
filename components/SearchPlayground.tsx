"use client";
import { useState } from 'react';

export default function SearchPlayground() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'hybrid'|'vector'|'keyword'>('hybrid');
  const [matchCount, setMatchCount] = useState(10);
  const [threshold, setThreshold] = useState(0.3);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/search/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode, matchCount, threshold })
      });
      const data = await res.json();
      if (data.error) {
        alert('Error: ' + data.error);
      } else {
        setResults(data.results || []);
      }
    } catch (e) {
      alert('Request failed: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex gap-2 mb-4">
        <input className="flex-1 p-2 border rounded" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введите запрос" />
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="p-2 border rounded">
          <option value="hybrid">Hybrid</option>
          <option value="vector">Vector</option>
          <option value="keyword">Keyword</option>
        </select>
        <button onClick={run} className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading || !query}> {loading ? 'Идёт...' : 'Поиск'}</button>
      </div>

      <div className="flex gap-3 mb-4 text-sm">
        <label className="flex items-center gap-2">Match count: <input type="number" value={matchCount} onChange={(e) => setMatchCount(Number(e.target.value))} className="w-20 p-1 border rounded ml-2"/></label>
        <label className="flex items-center gap-2">Threshold: <input type="number" step="0.01" min="0" max="1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-20 p-1 border rounded ml-2"/></label>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Results ({results.length})</h4>
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className="p-3 border rounded">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">id: {r.id || r.document_id}</div>
                <div className="text-xs flex items-center gap-2">
                  {/* similarity badge */}
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">{((r.similarity ?? r.final_score ?? 0) * 100).toFixed(1)}%</span>
                  {/* open source link if available */}
                  { (r.source_url || r.source) && (
                    <a href={r.source_url || r.source} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Open source</a>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm whitespace-pre-wrap">{r.content || r.quote || r.content_preview || ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
