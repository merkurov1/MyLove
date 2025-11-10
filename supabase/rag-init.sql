-- RAG DB INIT: documents, document_chunks, conversations, messages, индексы, гибридный поиск

-- 1. Таблица documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_l2_ops);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_fts ON document_chunks USING GIN (to_tsvector('russian', content));

-- 3. Таблица conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Таблица messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING hnsw (embedding vector_l2_ops);

CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_embedding vector(1536),
  query_text text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  embedding vector(1536),
  checksum text,
  created_at timestamptz,
  l2_distance float,
  fts_rank float,
  hybrid_score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    c.embedding,
    c.checksum,
    c.created_at,
    (c.embedding <-> query_embedding) AS l2_distance,
    ts_rank_cd(to_tsvector('russian', c.content), plainto_tsquery('russian', query_text)) AS fts_rank,
    (c.embedding <-> query_embedding) - 0.1 * ts_rank_cd(to_tsvector('russian', c.content), plainto_tsquery('russian', query_text)) AS hybrid_score
  FROM document_chunks c
  WHERE
    (c.embedding IS NOT NULL)
    AND (to_tsvector('russian', c.content) @@ plainto_tsquery('russian', query_text))
  ORDER BY hybrid_score ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  embedding vector(1536),
  checksum text,
  created_at timestamptz,
  l2_distance float,
  fts_rank float,
  hybrid_score float
)
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM hybrid_search_chunks(query_embedding, '', match_count);
END;
$$ LANGUAGE plpgsql STABLE;
