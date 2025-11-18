"use client";
import { useEffect, useState } from 'react';
import DocumentGraph from './DocumentGraph';

type DocItem = { id: string; title?: string };

export default function GraphStarter() {
  const [center, setCenter] = useState('');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/documents')
      .then((r) => r.json())
      .then((json) => {
        const list = (json.docs || []).map((d: any) => ({ id: d.id, title: d.title || d.id }));
        setDocs(list);
      })
      .catch((e) => {
        console.error('Failed to load documents for GraphStarter', e);
        setError('Не удалось загрузить список документов');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        <label className="sr-only" htmlFor="graph-doc-select">Выберите документ</label>
        {loading ? (
          <div className="p-2">Загрузка документов...</div>
        ) : error ? (
          <div className="p-2 text-red-600">{error}</div>
        ) : (
          <select
            id="graph-doc-select"
            className="flex-1 p-2 border rounded"
            value={center}
            onChange={(e) => setCenter(e.target.value)}
          >
            <option value="">-- Выберите документ для центра графа --</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>{d.title} — {d.id}</option>
            ))}
          </select>
        )}
      </div>

      {center ? (
        <DocumentGraph centerId={center} />
      ) : (
        <div className="p-4 border rounded text-sm text-gray-600">Выберите документ из списка</div>
      )}
    </div>
  );
}
