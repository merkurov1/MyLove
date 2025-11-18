"use client";
import { useState } from 'react';
import DocumentGraph from './DocumentGraph';

export default function GraphStarter() {
  const [center, setCenter] = useState('');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 p-2 border rounded"
          placeholder="Paste center document id"
          value={center}
          onChange={(e) => setCenter((e.target as HTMLInputElement).value)}
        />
      </div>
      {center ? (
        <DocumentGraph centerId={center} />
      ) : (
        <div className="p-4 border rounded text-sm text-gray-600">Введите id документа и нажмите Enter</div>
      )}
    </div>
  );
}
