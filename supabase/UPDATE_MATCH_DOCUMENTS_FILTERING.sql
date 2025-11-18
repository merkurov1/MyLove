-- supabase/UPDATE_MATCH_DOCUMENTS_FILTERING.sql
-- Template to add a wrapper RPC that allows optional filtering by chunk_type
-- IMPORTANT: adapt to your existing `match_documents` RPC signature and return columns.

-- This creates a wrapper function `match_documents_v2` which accepts an optional
-- `p_chunk_type` parameter. If provided, results will be filtered to chunks
-- that match the specified type before returning.

CREATE OR REPLACE FUNCTION public.match_documents_v2(query_embedding vector(1536), match_count integer, p_chunk_type text DEFAULT NULL)
RETURNS TABLE(
  document_id uuid,
  chunk_id uuid,
  similarity double precision
) AS $$
BEGIN
  -- This example assumes you have a `match_documents` RPC that returns (document_id, chunk_id, similarity)
  -- If your `match_documents` returns different columns, adjust the SELECT accordingly.

  IF p_chunk_type IS NULL THEN
    RETURN QUERY
    SELECT md.* FROM match_documents(query_embedding, match_count) AS md;
  ELSE
    RETURN QUERY
    SELECT md.*
    FROM match_documents(query_embedding, match_count) AS md
    JOIN document_chunks dc ON dc.id = md.chunk_id
    WHERE dc.chunk_type = p_chunk_type;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM match_documents_v2('<vector>', 10, 'Ключевая идея');
