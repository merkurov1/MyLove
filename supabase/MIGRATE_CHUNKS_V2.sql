-- supabase/MIGRATE_CHUNKS_V2.sql
-- Migration to add semantic chunk metadata to `document_chunks`
-- Idempotent: safe to run multiple times

BEGIN;

-- Add chunk_type if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'chunk_type'
  ) THEN
    ALTER TABLE public.document_chunks ADD COLUMN chunk_type text;
    RAISE NOTICE 'Added column document_chunks.chunk_type';
  ELSE
    RAISE NOTICE 'Column document_chunks.chunk_type already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'chunk_sentiment'
  ) THEN
    ALTER TABLE public.document_chunks ADD COLUMN chunk_sentiment text;
    RAISE NOTICE 'Added column document_chunks.chunk_sentiment';
  ELSE
    RAISE NOTICE 'Column document_chunks.chunk_sentiment already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'metadata_json'
  ) THEN
    ALTER TABLE public.document_chunks ADD COLUMN metadata_json jsonb;
    RAISE NOTICE 'Added column document_chunks.metadata_json';
  ELSE
    RAISE NOTICE 'Column document_chunks.metadata_json already exists';
  END IF;
END$$;

-- Optional: create simple indexes to speed up chunk_type filtering
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_type ON public.document_chunks (chunk_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_sentiment ON public.document_chunks (chunk_sentiment);

COMMIT;

-- Notes:
-- After running this migration, run the backfill script to populate the new columns
-- and re-generate embeddings if desired.
