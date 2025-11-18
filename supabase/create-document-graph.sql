-- supabase/create-document-graph.sql
-- Creates a lightweight document graph table to store k-NN edges between documents
CREATE TABLE IF NOT EXISTS document_graph (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL,
  target_document_id uuid NOT NULL,
  weight real NOT NULL,
  method text NOT NULL DEFAULT 'embedding',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_graph_source ON document_graph (source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_graph_target ON document_graph (target_document_id);

-- Optional: keep uniqueness (one directed edge per pair per method)
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_graph_pair_method ON document_graph (source_document_id, target_document_id, method);
