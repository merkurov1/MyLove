-- Create embedding cache table for cost optimization
-- Stores embeddings to avoid repeated API calls for same texts

CREATE TABLE IF NOT EXISTS public.embedding_cache (
    id SERIAL PRIMARY KEY,
    text_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the text
    original_text TEXT NOT NULL,    -- Original text for debugging
    embedding vector(1536),         -- OpenAI text-embedding-3-small dimension
    model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 1
);

-- Index for fast lookup by hash
CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash ON public.embedding_cache(text_hash);

-- Index for cleanup (TTL based on last access)
CREATE INDEX IF NOT EXISTS idx_embedding_cache_accessed ON public.embedding_cache(last_accessed);

-- RLS policies for embedding cache
DROP POLICY IF EXISTS "Allow full access to embedding_cache" ON public.embedding_cache;
CREATE POLICY "Allow full access to embedding_cache" ON public.embedding_cache
FOR ALL USING (true) WITH CHECK (true);

-- Function to get embedding with cache
CREATE OR REPLACE FUNCTION get_cached_embedding(
    input_text TEXT,
    model_name TEXT DEFAULT 'text-embedding-3-small'
) RETURNS vector(1536) AS $$
DECLARE
    text_hash TEXT;
    cached_embedding vector(1536);
BEGIN
    -- Generate hash of input text
    text_hash := encode(digest(input_text, 'sha256'), 'hex');

    -- Try to get from cache
    SELECT embedding INTO cached_embedding
    FROM public.embedding_cache
    WHERE text_hash = text_hash AND model = model_name;

    -- If found, update access stats
    IF cached_embedding IS NOT NULL THEN
        UPDATE public.embedding_cache
        SET last_accessed = NOW(), access_count = access_count + 1
        WHERE text_hash = text_hash AND model = model_name;
        RETURN cached_embedding;
    END IF;

    -- Not in cache, return null (will be handled by application)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to store embedding in cache
CREATE OR REPLACE FUNCTION store_embedding_cache(
    input_text TEXT,
    embedding_vector vector(1536),
    model_name TEXT DEFAULT 'text-embedding-3-small'
) RETURNS void AS $$
DECLARE
    text_hash TEXT;
BEGIN
    -- Generate hash of input text
    text_hash := encode(digest(input_text, 'sha256'), 'hex');

    -- Insert or update cache
    INSERT INTO public.embedding_cache (text_hash, original_text, embedding, model)
    VALUES (text_hash, input_text, embedding_vector, model_name)
    ON CONFLICT (text_hash) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        last_accessed = NOW(),
        access_count = embedding_cache.access_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old cache entries (optional)
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(days_old INTEGER DEFAULT 30) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.embedding_cache
    WHERE last_accessed < NOW() - INTERVAL '1 day' * days_old;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;