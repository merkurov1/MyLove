-- fix-response-cache-param.sql
-- Recreate find_cached_response with parameter names that avoid ambiguity

CREATE OR REPLACE FUNCTION find_cached_response(
  p_query_embedding vector(1536),
  p_similarity_threshold float DEFAULT 0.99
)
RETURNS TABLE (
  id uuid,
  llm_response jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.llm_response,
    1 - (r.query_embedding <=> p_query_embedding) as similarity
  FROM response_cache r
  WHERE 1 - (r.query_embedding <=> p_query_embedding) > p_similarity_threshold
  ORDER BY r.query_embedding <=> p_query_embedding
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_cached_response(vector(1536), float) IS 'Find cached LLM response by embedding (safe param names)';
