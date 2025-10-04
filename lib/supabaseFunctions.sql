-- Функция поиска ближайших документов по вектору
create or replace function match_documents(
  query_embedding vector,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  source_id uuid,
  embedding_provider text,
  created_at timestamptz,
  similarity float
) language plpgsql as $$
begin
  return query
    select id, content, metadata, source_id, embedding_provider, created_at,
      1 - (embedding <-> query_embedding) as similarity
    from documents
    order by embedding <-> query_embedding
    limit match_count;
end;
$$;
