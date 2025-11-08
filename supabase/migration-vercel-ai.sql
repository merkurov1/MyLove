-- Migration to Vercel AI SDK with OpenAI embeddings (1536 dimensions)
-- This script will recreate the database with the correct vector dimensions

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop old tables (WARNING: This will delete all data!)
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Keep sources table as is (it doesn't have embeddings)
-- Sources table should already exist

-- 1. Create documents table with 1536 dimensions
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create document_chunks table with 1536 dimensions
CREATE TABLE document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  checksum TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create conversations table (for future chat history)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create messages table (for future chat history)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for document_chunks
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_checksum ON document_chunks(checksum);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Indexes for documents
CREATE INDEX idx_documents_source_id ON documents(source_id);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- Indexes for messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);

-- Drop old version of match_document_chunks function
DROP FUNCTION IF EXISTS match_document_chunks(vector, integer, uuid);
DROP FUNCTION IF EXISTS match_document_chunks(vector(384), integer, uuid);
DROP FUNCTION IF EXISTS match_document_chunks(vector(768), integer, uuid);

-- Function to search document chunks by semantic similarity
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  filter_source_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE
    (filter_source_id IS NULL OR d.source_id = filter_source_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Drop old versions of match_documents function with different vector dimensions
DROP FUNCTION IF EXISTS match_documents(vector, integer);
DROP FUNCTION IF EXISTS match_documents(vector(384), integer);
DROP FUNCTION IF EXISTS match_documents(vector(768), integer);

-- Legacy function for backward compatibility (returns content directly)
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

-- Drop old version of hybrid_search_chunks function
DROP FUNCTION IF EXISTS hybrid_search_chunks(vector, text, integer);
DROP FUNCTION IF EXISTS hybrid_search_chunks(vector(384), text, integer);
DROP FUNCTION IF EXISTS hybrid_search_chunks(vector(768), text, integer);

-- Hybrid search function (combines vector similarity with full-text search)
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
  metadata jsonb,
  similarity float,
  fts_rank float,
  hybrid_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity,
    ts_rank_cd(to_tsvector('russian', dc.content), plainto_tsquery('russian', query_text)) AS fts_rank,
    (1 - (dc.embedding <=> query_embedding)) * 0.7 + 
    ts_rank_cd(to_tsvector('russian', dc.content), plainto_tsquery('russian', query_text)) * 0.3 AS hybrid_score
  FROM document_chunks dc
  WHERE
    to_tsvector('russian', dc.content) @@ plainto_tsquery('russian', query_text)
    OR (dc.embedding <=> query_embedding) < 0.5
  ORDER BY hybrid_score DESC
  LIMIT match_count;
END;
$$;

-- Create full-text search index
CREATE INDEX idx_document_chunks_content_fts ON document_chunks USING GIN (to_tsvector('russian', content));

-- Grant permissions (if needed)
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
