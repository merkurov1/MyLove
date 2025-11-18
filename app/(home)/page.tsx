import ChatAssistant from '@/components/ChatAssistant'
import { supabase } from '@/utils/supabase/server'

export default async function Page() {
  // Diagnostic: check if supabase is a stub or real client
  // @ts-ignore
  if (supabase.__missing) {
    console.warn('Supabase client is a stub! Check your env variables.');
  }

  // Diagnostic: check type of query builder
  const query = supabase
    .from('sources')
    .select('id, name, description');
  // @ts-ignore
  console.log('Query builder type:', typeof query, query);

  let sources = null;
  try {
    // Try to call .order if available
    if (typeof query.order === 'function') {
      const { data } = await query.order('created_at', { ascending: false });
      sources = data;
    } else {
      console.error('query.order is not a function! Query:', query);
      const { data } = await query;
      sources = data;
    }
  } catch (err) {
    console.error('Error fetching sources:', err);
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mt-0">
        <ChatAssistant />
      </div>
    </div>
  );
}