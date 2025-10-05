
"use client";
import React, { useEffect, useState } from "react";

interface Stats {
  documents?: number;
  chunks?: number;
  conversations?: number;
  messages?: number;
  sources_count?: number;
  documents_count?: number;
  total_content_length?: number;
  providers_used?: string[];
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-8 mb-8 animate-pulse">
      <div className="h-6 w-1/3 mb-4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-4 w-1/4 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/2 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/3 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/4 mb-2 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
  if (!stats) return <div>Нет данных</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17a2.5 2.5 0 002.5-2.5V15a2.5 2.5 0 00-2.5-2.5H9.5A2.5 2.5 0 007 15v.5A2.5 2.5 0 009.5 18H11zm0 0v2m0-2a2.5 2.5 0 01-2.5-2.5V15a2.5 2.5 0 012.5-2.5h1.5A2.5 2.5 0 0116 15v.5A2.5 2.5 0 0113.5 18H11zm0 0v2" />
        </svg>
        Статистика
      </h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-blue-600">{stats.sources_count ?? stats.documents}</div>
          <div className="text-gray-500 text-sm">Источников</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-blue-600">{stats.documents_count ?? stats.chunks}</div>
          <div className="text-gray-500 text-sm">Документов</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total_content_length ?? stats.messages}</div>
          <div className="text-gray-500 text-sm">Символов</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-blue-600">{stats.providers_used?.join(', ') || '—'}</div>
          <div className="text-gray-500 text-sm">Провайдеры</div>
        </div>
      </div>
    </div>
  );
}
