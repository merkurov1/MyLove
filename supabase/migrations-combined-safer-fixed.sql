-- migrations-combined-safer-fixed.sql
-- Safe combined migration: extensions + response_cache + document_graph + feedback + view
-- Uses CREATE IF NOT EXISTS + ALTER TABLE ... ADD COLUMN IF NOT EXISTS and checks before index/view creation.

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1) Response cache (create if absent)
CREATE TABLE IF NOT EXISTS response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text,
  response jsonb,
  sources jsonb DEFAULT '[]'::jsonb,
  model text,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

-- Ensure important columns exist (harmless if already present)
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS query_text text;
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS response jsonb;
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS sources jsonb DEFAULT '[]'::jsonb;
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS model text DEFAULT 'text-embedding-3-small';
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE response_cache ADD COLUMN IF NOT EXISTS last_used_at timestamptz DEFAULT now();

-- Create vector index only if embedding column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'response_cache' AND column_name = 'embedding'
  ) THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_response_cache_embedding_ivf ON response_cache USING ivfflat (embedding vector_l2_ops) WITH (lists = 128);';
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_response_cache_embedding_hnsw ON response_cache USING hnsw (embedding vector_cosine_ops);';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Не удалось создать ivfflat или hnsw индекс для response_cache.embedding — проверьте версию pgvector.';
      END;
    END;
  ELSE
    RAISE NOTICE 'Пропущено создание векторного индекса: колонка response_cache.embedding отсутствует.';
  END IF;
END;
$$;

-- 2) Document graph: ensure canonical schema (as in repo: source_document_id/target_document_id/weight/method)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'document_graph'
  ) THEN
    CREATE TABLE document_graph (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_document_id uuid NOT NULL,
      target_document_id uuid NOT NULL,
      weight real NOT NULL,
      method text NOT NULL DEFAULT 'embedding',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  ELSE
    -- Ensure canonical columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'source_document_id') THEN
      ALTER TABLE document_graph ADD COLUMN source_document_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'target_document_id') THEN
      ALTER TABLE document_graph ADD COLUMN target_document_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'weight') THEN
      ALTER TABLE document_graph ADD COLUMN weight real;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'method') THEN
      ALTER TABLE document_graph ADD COLUMN method text DEFAULT 'embedding';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'created_at') THEN
      ALTER TABLE document_graph ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'updated_at') THEN
      ALTER TABLE document_graph ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    -- If legacy columns document_id + neighbor_id exist, migrate them into canonical columns (only filling NULLs), then drop legacy columns.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'document_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'neighbor_id') THEN
      UPDATE document_graph
      SET source_document_id = COALESCE(source_document_id, document_id),
          target_document_id = COALESCE(target_document_id, neighbor_id),
          weight = COALESCE(weight, (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'document_graph' AND column_name = 'similarity') THEN similarity ELSE weight END)),
          method = COALESCE(method, 'embedding'),
          updated_at = now()
      WHERE document_id IS NOT NULL OR neighbor_id IS NOT NULL;

      ALTER TABLE document_graph DROP COLUMN IF EXISTS document_id;
      ALTER TABLE document_graph DROP COLUMN IF EXISTS neighbor_id;
      ALTER TABLE document_graph DROP COLUMN IF EXISTS similarity;
    ELSE
      RAISE NOTICE 'document_graph exists; canonical columns ensured. No legacy document_id/neighbor_id pair to migrate.';
    END IF;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_document_graph_source ON document_graph (source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_graph_target ON document_graph (target_document_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_graph_pair_method ON document_graph (source_document_id, target_document_id, method);

-- 3) Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id bigserial PRIMARY KEY,
  document_id uuid NULL,
  user_id uuid NULL,
  message_id uuid NULL,
  kind text NOT NULL,
  comment text NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Ensure feedback columns exist (safe if already present)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS document_id uuid;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS message_id uuid;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_feedback_document_id ON feedback (document_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);

-- 4) Create view only if response_cache has the required column
DROP VIEW IF EXISTS view_recent_response_cache;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'response_cache' AND column_name = 'last_used_at'
  ) THEN
    EXECUTE '
      CREATE VIEW view_recent_response_cache AS
      SELECT id, query_text, model, created_at, last_used_at
      FROM response_cache
      ORDER BY last_used_at DESC
      LIMIT 100
    ';
  ELSE
    RAISE NOTICE 'Skipping view creation: column response_cache.last_used_at is missing.';
  END IF;
END;
$$;

-- End of migration file
