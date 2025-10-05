import React from "react";
import StatsPanel from "./StatsPanel";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-72 min-h-screen bg-gray-900 text-white flex flex-col border-r border-gray-800">
      <div className="p-6 text-2xl font-bold tracking-tight border-b border-gray-800">
        MyLove RAG
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="block px-3 py-2 rounded hover:bg-gray-800 transition">Чат</Link>
        <Link href="/documents" className="block px-3 py-2 rounded hover:bg-gray-800 transition">Документы</Link>
        <Link href="/upload" className="block px-3 py-2 rounded hover:bg-gray-800 transition">Загрузка</Link>
        <Link href="/database" className="block px-3 py-2 rounded hover:bg-gray-800 transition">База данных</Link>
      </nav>
      <div className="p-4 border-t border-gray-800">
        <StatsPanel />
      </div>
    </aside>
  );
}
