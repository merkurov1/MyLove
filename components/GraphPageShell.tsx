"use client";
import ClientProviders from './ClientProviders';
import Sidebar from './Sidebar';
import { useState } from 'react';
import GraphStarter from './GraphStarter';

export default function GraphPageShell() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <ClientProviders>
      <div className="flex min-h-screen">
        <Sidebar isCollapsed={isCollapsed} onToggleCollapse={setIsCollapsed} />
        <main className={`flex-1 flex flex-col items-center p-4 overflow-auto transition-all duration-300 ml-0 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <div className="w-full max-w-5xl">
            <h2 className="text-2xl font-semibold mb-4">Document Graph Explorer</h2>
            <GraphStarter />
          </div>
        </main>
      </div>
    </ClientProviders>
  );
}
