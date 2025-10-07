"use client";
import { useState, useRef, useEffect } from "react";

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
    { id: "voyage", name: "Voyage AI (voyage-2, 768d, платно/лимит)" },
    { id: "huggingface", name: "Hugging Face (all-MiniLM-L6-v2, бесплатно)" },
    { id: "fireworks", name: "Fireworks (nomic-embed, лимит)" },
    { id: "openai", name: "OpenAI (ada-002, лимит)" },
    { id: "cohere", name: "Cohere (embed-english-v3.0, лимит)" },
    { id: "mixedbread", name: "Mixedbread (mxbai-embed-large-v1, бесплатно/лимит)" },
    { id: "groq", name: "Groq (ada-002, быстро, лимит)" },
    { id: "gemini", name: "Google Gemini (embedding-001, лимит)" },
  ];

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
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Чат с AI-ассистентом
            </h2>
            <p className="text-gray-600 mt-1">
              Задавайте вопросы по загруженным данным
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="embedding-provider-select" className="text-sm font-medium text-gray-700">
              Embedding:
            </label>
            <select
              id="embedding-provider-select"
              value={embeddingProvider}
              onChange={(e) => setEmbeddingProvider(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {embeddingProviders.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="flex flex-col h-96">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Начните разговор с AI-ассистентом
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg text-sm whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-900 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2 rounded-lg text-sm bg-gray-100 animate-pulse text-gray-400">
                AI думает...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4 border-t bg-gray-50">
          <input
            type="text"
            className="flex-1 border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Задайте вопрос..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || !userInput.trim()}
          >
            {isLoading ? "..." : "Отправить"}
          </button>
        </form>
        {debugInfo && (
          <div className="mt-4 p-4 bg-gray-100 rounded mx-4 mb-4">
            <h3 className="font-bold text-sm mb-2">Отладочная информация:</h3>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40 bg-white p-2 rounded border">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}