import ChatAssistant from '@/components/ChatAssistant'
import { supabase } from '@/utils/supabase/server'

export default async function Page() {
  const { data: sources } = await supabase
    .from('sources')
    .select('id, name, description')
    .order('created_at', { ascending: false })

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-3xl md:max-w-4xl lg:max-w-5xl">
        <ChatAssistant />
      </div>
    </div>
  )
}