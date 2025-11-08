"use client";

import { useState, useRef, useEffect } from "react";
import { FaUser, FaRobot, FaPaperPlane } from "react-icons/fa6";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatAssistant() {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    
    const currentQuery = userInput;
    setChatHistory((prev) => [...prev, { role: "user", content: currentQuery }]);
    setUserInput("");
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery }),
      });
      
      let reply = "Нет ответа.";
      let error = null;
      
      try {
        const data = await res.json();
        if (data.reply) reply = data.reply;
        if (data.error) error = data.error;
      } catch (e) {
        error = "Ошибка парсинга ответа.";
      }
      
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: error ? `Ошибка: ${error}` : reply },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: "Ошибка получения ответа от ассистента." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-4xl md:max-w-5xl xl:max-w-6xl h-full rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 flex flex-col overflow-hidden">
        <div className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-100/60 to-white/0 dark:from-gray-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FaRobot className="text-blue-500 text-2xl" />
            <span className="font-bold text-lg text-gray-800 dark:text-gray-100">AI-ассистент</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900 bg-gradient-to-b from-white/80 to-blue-50/60 dark:from-gray-900/80 dark:to-gray-950/60">
            {chatHistory.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-16 text-xl select-none">
                Начните разговор с AI-ассистентом
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex items-end gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow-lg">
                    <FaRobot className="text-blue-500 text-2xl" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] px-6 py-4 rounded-2xl text-base whitespace-pre-line shadow-md transition-all duration-200 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-3xl animate-fade-in-right"
                      : "bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 rounded-bl-3xl animate-fade-in-left border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-lg">
                    <FaUser className="text-gray-500 text-2xl" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-end gap-4 justify-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow-lg">
                  <FaRobot className="text-blue-500 text-2xl animate-bounce" />
                </div>
                <div className="max-w-[70%] px-6 py-4 rounded-2xl text-base bg-white/80 dark:bg-gray-800/80 text-gray-400 animate-pulse border border-gray-200 dark:border-gray-700">
                  AI думает...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-4 px-6 py-5 border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 flex-shrink-0">
          <input
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-full px-6 py-4 text-base bg-white/95 dark:bg-gray-800/95 text-gray-900 dark:text-gray-100 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Задайте вопрос..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isLoading}
            autoFocus
            autoComplete="off"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xl"
            disabled={isLoading || !userInput.trim()}
            aria-label="Отправить"
          >
            {isLoading ? (
              <span className="animate-spin">...</span>
            ) : (
              <FaPaperPlane className="text-xl" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}