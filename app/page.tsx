import { supabase } from '@/utils/supabase/server'
import FileUploader from '@/components/FileUploader'
import LinkProcessor from '@/components/LinkProcessor'
import ChatAssistant from '@/components/ChatAssistant'

interface Source {
  id: string
  name: string
  description?: string
}

export default async function Page() {
  const { data: sources } = await supabase
    .from('sources')
    .select('id, name, description')
    .order('created_at', { ascending: false })

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            AI-ассистент с базой знаний
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Загружайте данные и общайтесь с ИИ на основе ваших документов
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">
              Загрузка файлов
            </h2>
            <FileUploader sources={sources || []} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">
              Обработка ссылок
            </h2>
            <LinkProcessor sources={sources || []} />
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <ChatAssistant />
        </div>
      </div>
    </div>
  )
}