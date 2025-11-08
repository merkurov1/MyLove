"use client";
import React, { useState } from "react";
import StatsPanel from "./StatsPanel";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaComments, FaDatabase, FaBars, FaTimes } from "react-icons/fa";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  const isActive = (path: string) => pathname === path;
  
  const navLinks = [
    { href: "/", label: "Чат", icon: FaComments },
    { href: "/database", label: "Документы", icon: FaDatabase },
  ];

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 transition"
        aria-label="Toggle menu"
      >
        {isOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
      </button>

      {/* Overlay для мобильного меню */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40
          w-64 h-screen 
          bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 
          backdrop-blur-lg text-white 
          flex flex-col 
          border-r border-gray-800 
          shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 text-2xl font-bold tracking-tight border-b border-gray-800 flex items-center gap-3 bg-gradient-to-r from-blue-600/20 to-transparent">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-lg">ML</span>
          </div>
          <span className="bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
            MyLove
          </span>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-gray-800">
          <StatsPanel />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl 
                  transition-all duration-200
                  ${active 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50 scale-105' 
                    : 'hover:bg-blue-700/20 hover:scale-105'
                  }
                `}
              >
                <Icon className={`text-lg ${active ? 'text-white' : 'text-blue-400'}`} />
                <span className="font-medium">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono text-[10px]">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono text-[10px]">K</kbd>
              <span className="ml-2">Фокус</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono text-[10px]">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono text-[10px]">N</kbd>
              <span className="ml-2">Новый чат</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
