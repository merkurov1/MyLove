-- supabase/create-feedback.sql
-- Stores user feedback about assistant answers
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  message_text text,
  feedback_type text, -- 'thumbs_up' | 'thumbs_down' | 'wrong_source' | 'other'
  reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_conversation ON feedback (conversation_id);
