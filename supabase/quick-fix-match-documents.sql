-- Quick fix: Update match_documents function to use vector(1536) for OpenAI embeddings
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

-- Drop old versions with different vector dimensions
DROP FUNCTION IF EXISTS match_documents(vector, integer);
DROP FUNCTION IF EXISTS match_documents(vector(384), integer);
DROP FUNCTION IF EXISTS match_documents(vector(768), integer);

-- Create new version for OpenAI text-embedding-3-small (1536 dimensions)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 7
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verify the function was created correctly
SELECT 
  routine_name,
  data_type,
  character_maximum_length
FROM information_schema.routines
WHERE routine_name = 'match_documents'
  AND routine_schema = 'public';

-- Test the function (should not error if embeddings are vector(1536))
-- This will return top 3 chunks most similar to a random embedding vector
SELECT COUNT(*) as total_chunks_searchable
FROM document_chunks
WHERE embedding IS NOT NULL;
