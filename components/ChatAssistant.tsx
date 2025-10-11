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
  const [embeddingProvider, setEmbeddingProvider] = useState("voyage");
  const [debugInfo, setDebugInfo] = useState<object | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const embeddingProviders = [
    { id: "huggingface", name: "Hugging Face (all-MiniLM-L6-v2, бесплатно)" },
    { id: "mock", name: "Mock (тестовый режим)" },
  ];
  // По умолчанию Hugging Face
  useEffect(() => {
    setEmbeddingProvider("huggingface");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userMessage: Message = { role: "user", content: userInput };
    setChatHistory((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setDebugInfo({
      level: "INFO",
      status: "Sending request...",
      timestamp: new Date().toISOString(),
      query: userInput,
      embeddingProvider,
    });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userInput, embeddingProvider }),
      });

      setDebugInfo((prev) => ({
        ...(prev || {}),
        responseStatus: res.status,
        responseHeaders: Object.fromEntries(res.headers.entries()),
        timestamp: new Date().toISOString(),
      }));

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
  <div className="backdrop-blur-lg bg-white/70 dark:bg-gray-900/70 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-full md:max-w-2xl mx-auto overflow-hidden flex flex-col h-[70vh] md:h-[80vh]">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
        <label htmlFor="embedding-provider-select" className="text-xs font-medium text-gray-700 dark:text-gray-300">Embedding:</label>
        <select
          id="embedding-provider-select"
          value={embeddingProvider}
          onChange={(e) => setEmbeddingProvider(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        >
          {embeddingProviders.map((prov) => (
            <option key={prov.id} value={prov.id}>{prov.name}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900">
          {chatHistory.length === 0 && (
            <div className="text-center text-gray-400 dark:text-gray-500 py-12 text-lg select-none">
              Начните разговор с AI-ассистентом
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow">
                  <FaRobot className="text-blue-500 text-lg" />
                </div>
              )}
              <div
                className={`max-w-[75%] px-5 py-3 rounded-2xl text-base whitespace-pre-line shadow transition-all duration-200 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md animate-fade-in-right"
                    : "bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 rounded-bl-md animate-fade-in-left border border-gray-200 dark:border-gray-700"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow">
                  <FaUser className="text-gray-500 text-lg" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow">
                <FaRobot className="text-blue-500 text-lg animate-bounce" />
              </div>
              <div className="max-w-[75%] px-5 py-3 rounded-2xl text-base bg-white/80 dark:bg-gray-800/80 text-gray-400 animate-pulse border border-gray-200 dark:border-gray-700">
                AI думает...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-gray-900/60">
          <input
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-full px-5 py-3 text-base bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Задайте вопрос..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isLoading}
            autoFocus
            autoComplete="off"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={isLoading || !userInput.trim()}
            aria-label="Отправить"
          >
            {isLoading ? (
              <span className="animate-spin">...</span>
            ) : (
              <FaPaperPlane className="text-lg" />
            )}
          </button>
        </form>
        {debugInfo && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl mx-4 mb-4 border border-gray-200 dark:border-gray-700 shadow">
            <h3 className="font-bold text-xs mb-2 text-gray-700 dark:text-gray-200">Отладочная информация:</h3>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}