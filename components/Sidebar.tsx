import React from "react";
import StatsPanel from "./StatsPanel";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-gray-900/80 backdrop-blur-lg text-white flex flex-col border-r border-gray-800 shadow-2xl">
      <div className="p-6 text-2xl font-bold tracking-tight border-b border-gray-800 flex items-center gap-3">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2563eb"/><text x="12" y="17" textAnchor="middle" fontSize="14" fill="#fff" fontWeight="bold">ML</text></svg>
        MyLove
      </div>
      <div className="p-4 border-b border-gray-800">
        <StatsPanel />
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700/30 transition"><span>💬</span>Чат</Link>
        <Link href="/database" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700/30 transition"><span>📊</span>База данных</Link>
      </nav>
    </aside>
  );
}
