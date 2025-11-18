-- scripts/check-document-graph-inline.sql
-- Single-file diagnostic for document_graph that does not rely on CTEs or persistent
-- relations so it can be executed statement-by-statement in editors that split execution.
-- Replace the literal CENTER_UUID below if you want to inspect a different document.

-- Choose center (replace if needed)
-- Example center UUID from user's list:
-- dae69452-a961-4f99-a6e8-2411f818f039
-- To inspect another id, edit the CENTER_UUID value below.

-- NOTE: This file keeps each query independent by inlining a small derived table
-- that produces `center_id`. That prevents errors when editors run statements
-- separately and forget earlier WITH blocks.

-- Edit this value if you want a different center
\set CENTER_UUID 'dae69452-a961-4f99-a6e8-2411f818f039'

-- Show chosen center
SELECT 'INFO' AS kind, 'center_chosen' AS name, (select :'CENTER_UUID')::uuid AS value;

-- SECTION 1: Basic checks
SELECT 'SECTION' AS section, '1 - Basic checks (edges count and columns)' AS description;
SELECT count(*) AS edges_count FROM document_graph;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_graph'
ORDER BY ordinal_position;

-- SECTION 2: Sample edges (most recent 50)
SELECT 'SECTION' AS section, '2 - Sample edges (most recent 50)' AS description;
SELECT source_document_id, target_document_id, weight, method, created_at
FROM document_graph
ORDER BY created_at DESC NULLS LAST
LIMIT 50;

-- SECTION 3a: Outgoing edges FROM center (inline center)
SELECT 'SECTION' AS section, '3a - Outgoing edges FROM center' AS description;
SELECT dg.source_document_id, dg.target_document_id, dg.weight, dg.method, s.title AS source_title, t.title AS target_title
FROM document_graph dg
JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON true
LEFT JOIN documents s ON s.id = dg.source_document_id
LEFT JOIN documents t ON t.id = dg.target_document_id
WHERE dg.source_document_id = p.center_id
ORDER BY dg.weight DESC NULLS LAST
LIMIT 200;

-- SECTION 3b: Incoming edges TO center (inline center)
SELECT 'SECTION' AS section, '3b - Incoming edges TO center' AS description;
SELECT dg.source_document_id, dg.target_document_id, dg.weight, dg.method, s.title AS source_title, t.title AS target_title
FROM document_graph dg
JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON true
LEFT JOIN documents s ON s.id = dg.source_document_id
LEFT JOIN documents t ON t.id = dg.target_document_id
WHERE dg.target_document_id = p.center_id
ORDER BY dg.weight DESC NULLS LAST
LIMIT 200;

-- SECTION 4: Nodes without corresponding documents
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

-- SECTION 5: Degree statistics (top sources/targets)
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

-- SECTION 6a: Neighbor ids around center
SELECT 'SECTION' AS section, '6a - Neighbor ids around center' AS description;
SELECT DISTINCT id
FROM (
  SELECT target_document_id AS id FROM document_graph dg JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON true WHERE dg.source_document_id = p.center_id
  UNION
  SELECT source_document_id AS id FROM document_graph dg JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON true WHERE dg.target_document_id = p.center_id
) t
LIMIT 500;

-- SECTION 6b: Metadata for neighbor ids
SELECT 'SECTION' AS section, '6b - Metadata for neighbor ids' AS description;
SELECT d.id, d.title, d.source_url, d.created_at
FROM documents d
WHERE d.id IN (
  SELECT target_document_id FROM document_graph dg JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON true WHERE dg.source_document_id = p.center_id
  UNION
  SELECT source_document_id FROM document_graph dg JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON true WHERE dg.target_document_id = p.center_id
)
LIMIT 500;

-- SECTION 7: Embedding presence (no RPC calls)
SELECT 'SECTION' AS section, '7a - Check chosen center document embedding presence' AS description;
SELECT d.id, (d.document_embedding IS NOT NULL) AS has_embedding, d.created_at, d.title
FROM documents d
JOIN (SELECT (:'CENTER_UUID')::uuid AS center_id) p ON d.id = p.center_id;

SELECT 'INFO' AS kind, 'note' AS name, 'RPC calls skipped; run match_documents manually if desired' AS value;
