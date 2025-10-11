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
        <div className="max-w-4xl mx-auto">
          <ChatAssistant />
        </div>
      </div>
    </div>
  )
}