import ChatAssistant from '@/components/ChatAssistant'
import { supabase } from '@/utils/supabase/server'

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
            Общайтесь с ИИ на основе ваших документов
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <ChatAssistant sources={sources || []} />
        </div>
      </div>
    </div>
  )
}