import ChatAssistant from '@/components/ChatAssistant'
import { supabase } from '@/utils/supabase/server'

export default async function Page() {
  const { data: sources } = await supabase
    .from('sources')
    .select('id, name, description')
    .order('created_at', { ascending: false })

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mt-0">
        <ChatAssistant />
      </div>
    </div>
  )
}