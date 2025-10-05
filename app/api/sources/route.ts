import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase/server'

export async function GET() {
  const { data, error } = await supabase
    .from('sources')
    .select('id, name, description')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data })
}
