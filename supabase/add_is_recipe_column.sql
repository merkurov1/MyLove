-- supabase/add_is_recipe_column.sql
-- Adds a nullable boolean `is_recipe` column to `documents` if it doesn't exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'is_recipe'
  ) THEN
    ALTER TABLE public.documents
    ADD COLUMN is_recipe boolean DEFAULT false;
    RAISE NOTICE 'Added column documents.is_recipe';
  ELSE
    RAISE NOTICE 'Column documents.is_recipe already exists, skipping';
  END IF;
END$$;
