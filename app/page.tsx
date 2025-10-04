import ChatAssistant from '@/components/ChatAssistant'

export default function Page() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            AI-ассистент с базой знаний
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Общайтесь с ИИ на основе ваших документов
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <ChatAssistant />
        </div>
      </div>
    </div>
  )
}