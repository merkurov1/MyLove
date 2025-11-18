-- scripts/check-document-graph-safe.sql
-- Safe diagnostic script for document graph issues.
-- This version picks a center document automatically if you don't replace the placeholder
-- and avoids calling RPC functions to prevent errors in SQL editors that don't support them.
-- Usage:
-- 1) In Supabase SQL editor: open a new query and run this file as-is. It will pick a center
--    document (the one with the given id if present, otherwise the most recent document).
-- 2) Or run with psql: psql "postgresql://<user>:<pass>@<host>:5432/<db>" -f scripts/check-document-graph-safe.sql

-- If you want to force a particular center, replace the literal in the COALESCE() below with
-- a UUID string, e.g. 'd8f5...'.

WITH params AS (
  SELECT COALESCE(
    -- Replace this literal with your center id if desired; leave as-is to auto-select
    (SELECT id FROM documents WHERE id = 'REPLACE_CENTER_ID' LIMIT 1),
    -- fallback: most recently created document
    (SELECT id FROM documents ORDER BY created_at DESC NULLS LAST LIMIT 1)
  ) AS center_id
)

-- Show which center was chosen
SELECT 'INFO' AS kind, 'center_chosen' AS name, (SELECT center_id FROM params) AS value;

-- ==================================================================
-- SECTION 1: Basic checks
-- ==================================================================
SELECT 'SECTION' AS section, '1 - Basic checks (edges count and columns)' AS description;

SELECT count(*) AS edges_count FROM document_graph;

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
-- SECTION 3: Edges for the chosen center
-- ==================================================================
SELECT 'SECTION' AS section, '3a - Outgoing edges FROM center' AS description;

SELECT dg.source_document_id, dg.target_document_id, dg.weight, dg.method, s.title AS source_title, t.title AS target_title
FROM document_graph dg
LEFT JOIN params p ON true
LEFT JOIN documents s ON s.id = dg.source_document_id
LEFT JOIN documents t ON t.id = dg.target_document_id
WHERE dg.source_document_id = p.center_id
ORDER BY dg.weight DESC NULLS LAST
LIMIT 200;

SELECT 'SECTION' AS section, '3b - Incoming edges TO center' AS description;

SELECT dg.source_document_id, dg.target_document_id, dg.weight, dg.method, s.title AS source_title, t.title AS target_title
FROM document_graph dg
LEFT JOIN params p ON true
LEFT JOIN documents s ON s.id = dg.source_document_id
LEFT JOIN documents t ON t.id = dg.target_document_id
WHERE dg.target_document_id = p.center_id
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
  SELECT target_document_id AS id FROM document_graph dg JOIN params p ON true WHERE dg.source_document_id = p.center_id
  UNION
  SELECT source_document_id AS id FROM document_graph dg JOIN params p ON true WHERE dg.target_document_id = p.center_id
) t
LIMIT 500;

SELECT 'SECTION' AS section, '6b - Metadata for neighbor ids' AS description;

SELECT d.id, d.title, d.source_url, d.created_at
FROM documents d
WHERE d.id IN (
  SELECT target_document_id FROM document_graph dg JOIN params p ON true WHERE dg.source_document_id = p.center_id
  UNION
  SELECT source_document_id FROM document_graph dg JOIN params p ON true WHERE dg.target_document_id = p.center_id
)
LIMIT 500;

-- ==================================================================
-- SECTION 7: Document embedding presence (we will NOT call RPC here)
-- ==================================================================
SELECT 'SECTION' AS section, '7a - Check chosen center document embedding presence' AS description;

SELECT d.id, (d.document_embedding IS NOT NULL) AS has_embedding, d.created_at, d.title
FROM documents d
JOIN params p ON d.id = p.center_id;

-- If you need to run the match_documents RPC, run this manually (example):
-- SELECT * FROM match_documents((SELECT document_embedding FROM documents WHERE id = '<CENTER_ID>'), 10);

SELECT 'INFO' AS kind, 'note' AS name, 'RPC calls skipped in safe script; run match_documents manually if desired' AS value;

-- End of script
