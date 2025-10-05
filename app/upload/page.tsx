import { supabase } from '@/utils/supabase/server'
import UploadTabs from '@/components/UploadTabs'

interface Source {
  id: string
  name: string
  description?: string
}

export default async function UploadPage() {
  const { data: sources } = await supabase
    .from('sources')
    .select('id, name, description')
    .order('created_at', { ascending: false })

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Управление данными
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Загружайте файлы и ссылки в базу знаний
          </p>
        </div>
        <UploadTabs sources={sources || []} />
      </div>
    </div>
  )
}