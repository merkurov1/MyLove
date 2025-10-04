import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Создаем клиент с service role ключом для серверных операций
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Типы для наших таблиц
export interface Source {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface Document {
  id: string
  content: string
  embedding: number[] // 384 измерения для HuggingFace
  checksum: string
  source_id: string
  metadata?: Record<string, any>
  embedding_provider?: string
  created_at: string
}