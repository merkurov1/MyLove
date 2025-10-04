import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  // Всего документов
  const { count: totalDocs } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  // По источникам
  const { data: docs } = await supabase
    .from('documents')
    .select('source_id, metadata')
  const sourceCounts: Record<string, number> = {}
  docs?.forEach(doc => {
    const src = doc.metadata?.filename || doc.metadata?.url || '—'
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
  })

  // По типам
  const typeCounts: Record<string, number> = {}
  docs?.forEach(doc => {
    const type = doc.metadata?.source_type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })

  return NextResponse.json({ totalDocs, sourceCounts, typeCounts })
}
