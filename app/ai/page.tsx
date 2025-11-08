import Link from 'next/link';
import { FaBrain, FaSearch, FaFileAlt, FaDollarSign, FaArrowRight } from 'react-icons/fa';

export default function PromoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo/Icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-5xl md:text-6xl">🎭</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Pierrot AI: Интеллект,<br />Раскрывающий Текст
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-purple-200 mb-8 leading-relaxed">
            Pierrot AI — это не просто чат-бот, это ваш персональный AI-ассистент для глубокого анализа текстов, 
            психолингвистических исследований и профессиональной работы с документами.
          </p>

          <p className="text-lg md:text-xl text-purple-300 mb-12">
            Созданный на базе передовой технологии <span className="font-semibold text-purple-100">RAG (Retrieval-Augmented Generation)</span>, 
            Pierrot AI соединяет мощь GPT-4o-mini с точностью векторного поиска.
          </p>

          {/* CTA Button */}
          <Link 
            href="/"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-lg px-8 py-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            Попробовать Pierrot AI
            <FaArrowRight />
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Feature 1: Глубокая Аналитика */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-300/20 hover:border-purple-300/40 transition-all duration-300 hover:transform hover:scale-105">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center">
                <FaBrain className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Глубокая Аналитика для Экспертов
              </h2>
            </div>
            <p className="text-purple-100 mb-6 text-lg leading-relaxed">
              Забудьте о поверхностном Q&A. Pierrot AI предлагает специализированные промпты для исследователей, 
              публицистов и аналитиков:
            </p>
            <ul className="space-y-3 text-purple-200">
              <li className="flex items-start gap-3">
                <span className="text-purple-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Психолингвистический Анализ:</strong> Выявляйте языковые паттерны, эмоциональный тон и риторические приёмы.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Профайлинг Автора:</strong> Составляйте когнитивный и психологический портрет, анализируя мотивацию по стилю письма.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Сравнение Документов:</strong> Получите детальный анализ различий в стилистике, аргументации и содержании двух и более текстов.</span>
              </li>
            </ul>
          </div>

          {/* Feature 2: Точность Поиска */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-300/20 hover:border-purple-300/40 transition-all duration-300 hover:transform hover:scale-105">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-400 rounded-xl flex items-center justify-center">
                <FaSearch className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Идеальная Точность Поиска
              </h2>
            </div>
            <p className="text-purple-100 mb-6 text-lg leading-relaxed">
              Мы используем технологии, обеспечивающие максимальную релевантность и низкую задержку:
            </p>
            <ul className="space-y-3 text-purple-200">
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Гибридный Поиск:</strong> Уникальное сочетание 70% семантики (векторный поиск по смыслу) и 30% ключевых слов для непревзойденной точности.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Молниеносная Скорость:</strong> HNSW индекс в базе данных Supabase PostgreSQL позволяет мгновенно искать по 1536-мерным векторам.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Интеллектуальный Чат:</strong> GPT-4o-mini для быстрой генерации ответов, автоматическое определение намерений и цитирование источников с прямыми ссылками.</span>
              </li>
            </ul>
          </div>

          {/* Feature 3: Работа с Документами */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-300/20 hover:border-purple-300/40 transition-all duration-300 hover:transform hover:scale-105">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-400 rounded-xl flex items-center justify-center">
                <FaFileAlt className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Работайте с Документами Без Ограничений
              </h2>
            </div>
            <p className="text-purple-100 mb-6 text-lg leading-relaxed">
              Простая загрузка, умная обработка:
            </p>
            <ul className="space-y-3 text-purple-200">
              <li className="flex items-start gap-3">
                <span className="text-orange-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Поддержка Форматов:</strong> Загружайте .txt и .docx файлы.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Умное Разбиение:</strong> Автоматическое и логичное чанкирование (до 2000 символов с перекрытием 200) для сохранения контекста.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Двуязычная Поддержка:</strong> Свободная работа с текстами на русском и английском языках.</span>
              </li>
            </ul>
          </div>

          {/* Feature 4: Оптимизация Бюджета */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-300/20 hover:border-purple-300/40 transition-all duration-300 hover:transform hover:scale-105">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-400 rounded-xl flex items-center justify-center">
                <FaDollarSign className="text-3xl text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Оптимизация Бюджета
              </h2>
            </div>
            <p className="text-purple-100 mb-6 text-lg leading-relaxed">
              Pierrot AI спроектирован с учетом эффективности:
            </p>
            <ul className="space-y-3 text-purple-200">
              <li className="flex items-start gap-3">
                <span className="text-yellow-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Условный Reranking</strong> через LLM для экономии токенов.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-yellow-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Минимальная телеметрия</strong> и эффективное кэширование.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-yellow-400 font-bold mt-1">•</span>
                <span><strong className="text-white">Низкая стоимость:</strong> Активное использование одним пользователем может составлять всего $0.78/месяц.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Pierrot AI: Раскройте истинный смысл и потенциал любого текста
        </h2>
        <Link 
          href="/"
          className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-lg px-8 py-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105"
        >
          Начать работу
          <FaArrowRight />
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-purple-300/20 py-8">
        <div className="container mx-auto px-4 text-center text-purple-300">
          <p>Создано с ❤️ используя Next.js, OpenAI и Supabase</p>
          <p className="mt-2">
            <Link href="https://merkurov.love" className="hover:text-purple-100 transition-colors">
              merkurov.love
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
