-- scripts/check-document-graph.sql
-- Diagnostic script for document graph issues.
-- Usage:
-- 1) In Supabase SQL editor: open a new query, replace REPLACE_CENTER_ID with the document id you want
--    to inspect, then run the whole script.
-- 2) Or run with psql: psql "postgresql://<user>:<pass>@<host>:5432/<db>" -f scripts/check-document-graph.sql
-- NOTE: replace the placeholder 'REPLACE_CENTER_ID' below with your actual center document UUID.

-- ==================================================================
-- SECTION 1: Basic checks
-- ==================================================================
SELECT 'SECTION' AS section, '1 - Basic checks (edges count and columns)' AS description;

-- 1.1 Count edges
SELECT count(*) AS edges_count FROM document_graph;

-- 1.2 Columns present on the document_graph table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_graph'
ORDER BY ordinal_position;

-- ==================================================================
-- SECTION 2: Sample edges
-- ==================================================================
SELECT 'SECTION' AS section, '2 - Sample edges (most recent 50)' AS description;

SELECT source_document_id, target_document_id, weight, method, created_at
FROM document_graph
ORDER BY created_at DESC NULLS LAST
LIMIT 50;

-- ==================================================================
-- SECTION 3: Edges for a specific center (replace REPLACE_CENTER_ID)
-- ==================================================================
SELECT 'SECTION' AS section, '3a - Outgoing edges FROM center' AS description;

SELECT dg.source_document_id, dg.target_document_id, dg.weight, dg.method, s.title AS source_title, t.title AS target_title
FROM document_graph dg
LEFT JOIN documents s ON s.id = dg.source_document_id
LEFT JOIN documents t ON t.id = dg.target_document_id
WHERE dg.source_document_id = 'REPLACE_CENTER_ID'
ORDER BY dg.weight DESC NULLS LAST
LIMIT 200;

SELECT 'SECTION' AS section, '3b - Incoming edges TO center' AS description;

SELECT dg.source_document_id, dg.target_document_id, dg.weight, dg.method, s.title AS source_title, t.title AS target_title
FROM document_graph dg
LEFT JOIN documents s ON s.id = dg.source_document_id
LEFT JOIN documents t ON t.id = dg.target_document_id
WHERE dg.target_document_id = 'REPLACE_CENTER_ID'
ORDER BY dg.weight DESC NULLS LAST
LIMIT 200;

-- ==================================================================
-- SECTION 4: Nodes without corresponding documents
-- ==================================================================
SELECT 'SECTION' AS section, '4a - Sources without documents (missing metadata)' AS description;

SELECT DISTINCT dg.source_document_id AS missing_id
FROM document_graph dg
LEFT JOIN documents d ON d.id = dg.source_document_id
WHERE d.id IS NULL
LIMIT 50;

SELECT 'SECTION' AS section, '4b - Targets without documents (missing metadata)' AS description;

SELECT DISTINCT dg.target_document_id AS missing_id
FROM document_graph dg
LEFT JOIN documents d ON d.id = dg.target_document_id
WHERE d.id IS NULL
LIMIT 50;

-- ==================================================================
-- SECTION 5: Degree statistics (top sources/targets)
-- ==================================================================
SELECT 'SECTION' AS section, '5a - Top sources by out-degree' AS description;

SELECT source_document_id, COUNT(*) AS out_deg
FROM document_graph
GROUP BY source_document_id
ORDER BY out_deg DESC
LIMIT 20;

SELECT 'SECTION' AS section, '5b - Top targets by in-degree' AS description;

SELECT target_document_id, COUNT(*) AS in_deg
FROM document_graph
GROUP BY target_document_id
ORDER BY in_deg DESC
LIMIT 20;

-- ==================================================================
-- SECTION 6: Neighbors and metadata for center
-- ==================================================================
SELECT 'SECTION' AS section, '6a - Neighbor ids around center' AS description;

SELECT DISTINCT id
FROM (
  SELECT target_document_id AS id FROM document_graph WHERE source_document_id = 'REPLACE_CENTER_ID'
  UNION
  SELECT source_document_id AS id FROM document_graph WHERE target_document_id = 'REPLACE_CENTER_ID'
) t
LIMIT 500;

SELECT 'SECTION' AS section, '6b - Metadata for neighbor ids' AS description;

SELECT d.id, d.title, d.source_url, d.created_at
FROM documents d
WHERE d.id IN (
  SELECT target_document_id FROM document_graph WHERE source_document_id = 'REPLACE_CENTER_ID'
  UNION
  SELECT source_document_id FROM document_graph WHERE target_document_id = 'REPLACE_CENTER_ID'
)
LIMIT 500;

-- ==================================================================
-- SECTION 7: Document embedding & match_documents RPC (if available)
-- ==================================================================
SELECT 'SECTION' AS section, '7a - Check center document embedding presence' AS description;

SELECT id, (document_embedding IS NOT NULL) AS has_embedding
FROM documents
WHERE id = 'REPLACE_CENTER_ID';

-- If your DB allows calling RPC from the SQL editor, the following runs the match_documents RPC
-- and shows the top neighbors for the chosen document embedding. If the RPC does not exist
-- or your environment prevents RPC calls here, this statement will error — that's expected.
-- Replace the match count as needed.
SELECT 'SECTION' AS section, '7b - Attempt match_documents RPC for center (may error if RPC missing)' AS description;

SELECT * FROM match_documents((SELECT document_embedding FROM documents WHERE id = 'REPLACE_CENTER_ID'), 10);

-- End of script
