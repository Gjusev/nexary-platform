BEGIN;

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS projectnexus;

-- Add soft-delete columns to rag_documents
ALTER TABLE IF EXISTS projectnexus.rag_documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Helpful indexes for filtering and lookups
CREATE INDEX IF NOT EXISTS idx_rag_documents_deleted_at
  ON projectnexus.rag_documents(deleted_at);

CREATE INDEX IF NOT EXISTS idx_rag_documents_package_active
  ON projectnexus.rag_documents(package_id)
  WHERE deleted_at IS NULL;

COMMIT;

