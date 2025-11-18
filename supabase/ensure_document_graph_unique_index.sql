-- supabase/ensure_document_graph_unique_index.sql
-- Safe, idempotent migration to deduplicate `document_graph` and create
-- a unique index on (source_document_id, target_document_id, method).
-- Usage: run this once in a maintenance window. It is safe to re-run.

DO $$
BEGIN
  -- Only operate if the table exists
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'document_graph' AND n.nspname = 'public'
  ) THEN

    -- Delete exact duplicates: keep the most recent row per (source, target, method).
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY source_document_id, target_document_id, COALESCE(method, '')
               ORDER BY COALESCE(created_at, now()) DESC, id
             ) AS rn
      FROM public.document_graph
    )
    DELETE FROM public.document_graph d
    USING ranked r
    WHERE d.id = r.id AND r.rn > 1;

    -- Create unique index if it does not already exist. The index name is stable.
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'uq_document_graph_pair_method' AND n.nspname = 'public'
    ) THEN
      CREATE UNIQUE INDEX uq_document_graph_pair_method
        ON public.document_graph (source_document_id, target_document_id, method);
    END IF;

  END IF;
END
$$;

-- Notes:
-- 1) Keeps the most recent row per (source_document_id, target_document_id, method).
-- 2) Designed to be idempotent and safe to re-run.
-- 3) Run in a maintenance window for large tables to avoid long locks.
-- 4) After this migration, upserts specifying ON CONFLICT (source_document_id, target_document_id, method)
--    should succeed without Postgres error 42P10.
