"use client";

import { useState, useRef, useEffect } from "react";
import { FaUser, FaRobot, FaPaperPlane, FaCircleExclamation, FaClockRotateLeft, FaPlus, FaXmark, FaComments, FaCopy, FaCheck } from "react-icons/fa6";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
  sources?: string;
  timestamp?: Date;
}

interface Stats {
  documentsCount: number;
  chunksCount: number;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  lastMessage?: {
    content: string;
    role: string;
    created_at: string;
  };
}

// Relative time formatting
const getRelativeTime = (date: Date | undefined) => {
  if (!date) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 10) return 'только что';
  if (diffSecs < 60) return `${diffSecs} сек назад`;
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays === 1) return 'вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function ChatAssistant() {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({ documentsCount: 0, chunksCount: 0 });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Загружаем статистику и историю разговоров при монтировании
  useEffect(() => {
    // Статистика
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.documents !== undefined && data.chunks !== undefined) {
          setStats({ documentsCount: data.documents, chunksCount: data.chunks });
        }
      })
      .catch(err => console.error('Failed to load stats:', err));

    // История разговоров
    loadConversations();
  }, []);

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K - фокус на инпут
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape - закрыть историю
      if (e.key === 'Escape' && showHistory) {
        e.preventDefault();
        setShowHistory(false);
      }
      
      // Ctrl+N / Cmd+N - новый чат
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        startNewConversation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistory]);

  // Загрузка списка разговоров
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Загрузка конкретного разговора
  const loadConversation = async (conversationId: string) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();
      if (data.messages) {
        // Преобразуем сообщения из БД в формат UI
        const messages: Message[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          sources: msg.metadata?.sources,
        }));
        setChatHistory(messages);
        setCurrentConversationId(conversationId);
        setShowHistory(false);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  // Начать новый разговор
  const startNewConversation = () => {
    setChatHistory([]);
    setCurrentConversationId(null);
    setShowHistory(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  // Парсинг ответа на answer и sources
  const parseResponse = (content: string): { answer: string; sources?: string } => {
    const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    if (content.includes(separator)) {
      const parts = content.split(separator);
      return {
        answer: parts[0].trim(),
        sources: parts[1]?.trim()
      };
    }
    return { answer: content };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    
    const currentQuery = userInput;
    setChatHistory((prev) => [...prev, { role: "user", content: currentQuery, timestamp: new Date() }]);
    setUserInput("");
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: currentQuery,
          conversationId: currentConversationId 
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        setChatHistory((prev) => [
          ...prev,
          { role: "error", content: data.error || "Ошибка сервера" },
        ]);
        return;
      }
      
      const data = await res.json();
      
      if (data.error) {
        setChatHistory((prev) => [
          ...prev,
          { role: "error", content: data.error },
        ]);
        return;
      }
      
      const parsed = parseResponse(data.reply || "Нет ответа.");
      setChatHistory((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: parsed.answer,
          sources: parsed.sources,
          timestamp: new Date()
        },
      ]);

      // Обновляем список разговоров после получения ответа
      loadConversations();
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: "error", content: "Не удалось получить ответ от сервера. Проверьте подключение." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-4xl md:max-w-5xl xl:max-w-6xl h-full rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-100/60 to-white/0 dark:from-gray-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FaRobot className="text-blue-500 text-2xl" />
            <span className="font-bold text-lg text-gray-800 dark:text-gray-100">AI-ассистент</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewConversation}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm transition shadow"
              title="Новый чат"
            >
              <FaPlus className="text-sm" />
              <span className="hidden sm:inline">Новый чат</span>
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg flex items-center gap-2 text-sm transition shadow"
              title="История"
            >
              <FaClockRotateLeft className="text-sm" />
              <span className="hidden sm:inline">История ({conversations.length})</span>
            </button>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="absolute top-[73px] right-0 w-80 h-[calc(100%-73px)] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FaComments className="text-blue-500" />
                <span className="font-semibold text-gray-800 dark:text-gray-100">История чатов</span>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaXmark className="text-xl" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {conversations.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                  Нет сохраненных чатов
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      currentConversationId === conv.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-800 dark:text-gray-100 mb-1 truncate">
                      {conv.title || 'Разговор'}
                    </div>
                    {conv.lastMessage && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {conv.lastMessage.content.substring(0, 50)}...
                      </div>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(conv.updated_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900 bg-gradient-to-b from-white/80 to-blue-50/60 dark:from-gray-900/80 dark:to-gray-950/60">
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                <svg className="w-24 h-24 text-gray-300 dark:text-gray-700 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Начните разговор с AI-ассистентом
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-600 max-w-md">
                  Задайте вопрос о документах, попросите анализ или сравнение текстов
                </p>
              </div>
            )}
            {chatHistory.map((msg, i) => {
              // Специальная обработка ошибок
              if (msg.role === "error") {
                return (
                  <div key={i} className="flex items-start gap-3 max-w-[85%] animate-fade-in-left">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <FaCircleExclamation className="text-red-500 text-xl" />
                    </div>
                    <div className="flex-1 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">
                      <div className="font-semibold text-red-700 dark:text-red-400 text-sm mb-1">
                        Ошибка
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-300">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={i} className={`flex items-end gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow-lg">
                      <FaRobot className="text-blue-500 text-2xl" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] px-6 py-4 rounded-2xl text-base shadow-md transition-all duration-200 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-3xl animate-fade-in-right"
                        : "bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 rounded-bl-3xl animate-fade-in-left border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-line">{msg.content}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:my-2 prose-pre:relative prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-gray-100">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: ({ node, inline, className, children, ...props }: any) => {
                              const [copied, setCopied] = useState(false);
                              const codeString = String(children).replace(/\n$/, '');
                              
                              const handleCopy = () => {
                                navigator.clipboard.writeText(codeString);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              };
                              
                              if (inline) {
                                return <code className={className} {...props}>{children}</code>;
                              }
                              
                              return (
                                <div className="relative group">
                                  <button
                                    onClick={handleCopy}
                                    className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={copied ? "Скопировано!" : "Копировать код"}
                                  >
                                    {copied ? <FaCheck className="text-sm" /> : <FaCopy className="text-sm" />}
                                  </button>
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </div>
                              );
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.sources && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 font-semibold">
                          📚 Источники:
                        </div>
                        <div className="prose prose-xs dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-code:text-xs">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.sources}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    {/* Timestamp */}
                    {msg.timestamp && (
                      <div className={`text-xs mt-2 ${msg.role === "user" ? "text-blue-200" : "text-gray-400 dark:text-gray-500"}`}>
                        {getRelativeTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-lg">
                      <FaUser className="text-gray-500 text-2xl" />
                    </div>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex items-end gap-4 justify-start animate-fade-in-left">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shadow-lg">
                  <FaRobot className="text-blue-500 text-2xl animate-bounce" />
                </div>
                <div className="max-w-[70%] px-6 py-4 rounded-2xl text-base bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 space-y-2">
                  {/* Skeleton loader */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-gray-700 dark:text-gray-300">AI думает</span>
                    <span className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  </div>
                  <div className="skeleton-line h-4 w-full"></div>
                  <div className="skeleton-line h-4 w-5/6"></div>
                  <div className="skeleton-line h-4 w-4/5"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-4 px-6 py-5 border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-full px-6 py-4 text-base bg-white/95 dark:bg-gray-800/95 text-gray-900 dark:text-gray-100 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Задайте вопрос... (Ctrl+K)"
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