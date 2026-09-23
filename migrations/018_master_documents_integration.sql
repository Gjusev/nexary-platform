-- Migration: Multi-Source RAG - Master Documents Integration
-- Extends master_documents table to support external source tracking

-- Add columns to master_documents for external source integration
ALTER TABLE projectnexus.master_documents
  ADD COLUMN IF NOT EXISTS external_document_id UUID
    REFERENCES projectnexus.external_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;

-- Index for quick lookups by external document
CREATE INDEX IF NOT EXISTS idx_master_docs_external_document_id ON projectnexus.master_documents(external_document_id)
  WHERE external_document_id IS NOT NULL;

-- Index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_master_docs_source_type ON projectnexus.master_documents(source_type)
  WHERE source_type IS NOT NULL;

-- Index for documents needing sync
CREATE INDEX IF NOT EXISTS idx_master_docs_external_sync ON projectnexus.master_documents(external_document_id, external_synced_at DESC)
  WHERE external_document_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN projectnexus.master_documents.external_document_id IS 'Link to external_documents table if this doc came from an external source';
COMMENT ON COLUMN projectnexus.master_documents.source_type IS 'External source type: confluence, notion, sharepoint, google_drive, slack, web, database';
COMMENT ON COLUMN projectnexus.master_documents.external_url IS 'Original URL of the document in the external source';
COMMENT ON COLUMN projectnexus.master_documents.external_metadata IS 'Source-specific metadata (space keys, versions, etc.)';
COMMENT ON COLUMN projectnexus.master_documents.external_synced_at IS 'Last time this document was synced from the external source';

-- View for external documents with their master document status
CREATE OR REPLACE VIEW projectnexus.v_external_master_documents AS
SELECT
  ed.id AS external_document_id,
  ed.data_source_id,
  ds.name AS data_source_name,
  ds.source_type,
  ed.external_id,
  ed.external_url,
  ed.title,
  ed.sync_status AS external_sync_status,
  ed.indexed_at,
  md.id AS master_document_id,
  md.status AS master_doc_status,
  md.created_at AS master_doc_created_at,
  md.external_synced_at,
  -- Count of RAG assignments
  (SELECT COUNT(*) FROM projectnexus.document_rag_assignments dra WHERE dra.master_document_id = md.id) AS rag_assignments_count
FROM projectnexus.external_documents ed
JOIN projectnexus.data_sources ds ON ds.id = ed.data_source_id
LEFT JOIN projectnexus.master_documents md ON md.external_document_id = ed.id
WHERE ed.deleted_at IS NULL
ORDER BY ed.external_updated_at DESC;

COMMENT ON VIEW projectnexus.v_external_master_documents IS 'External documents with their master document and RAG assignment status';

-- View for documents that need to be synced to RAG packages
CREATE OR REPLACE VIEW projectnexus.v_external_docs_pending_rag AS
SELECT
  ed.id AS external_document_id,
  ed.data_source_id,
  ds.team_slug,
  ds.name AS data_source_name,
  ds.auto_rag_package_ids,
  ed.external_id,
  ed.title,
  ed.sync_status,
  md.id AS master_document_id,
  -- RAG packages this document is already assigned to
  ARRAY(
    SELECT DISTINCT rag_package_id
    FROM projectnexus.document_rag_assignments dra
    WHERE dra.master_document_id = md.id
  ) AS assigned_rag_package_ids
FROM projectnexus.external_documents ed
JOIN projectnexus.data_sources ds ON ds.id = ed.data_source_id
LEFT JOIN projectnexus.master_documents md ON md.external_document_id = ed.id
WHERE ed.deleted_at IS NULL
  AND ed.sync_status = 'indexed'
  AND (
    -- Has auto-assign packages but not assigned yet
    (ARRAY_LENGTH(ds.auto_rag_package_ids, 1) > 0 AND NOT EXISTS (
      SELECT 1 FROM projectnexus.document_rag_assignments dra
      WHERE dra.master_document_id = md.id
        AND dra.rag_package_id = ANY(ds.auto_rag_package_ids)
    ))
    OR -- No master document yet
    md.id IS NULL
  );

COMMENT ON VIEW projectnexus.v_external_docs_pending_rag IS 'External documents that need to be assigned to RAG packages';

-- Function to check if a document has changed since last sync
CREATE OR REPLACE FUNCTION check_external_document_changed(
  p_external_document_id UUID,
  p_new_checksum TEXT,
  p_new_updated_at TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_checksum TEXT;
  v_current_updated_at TIMESTAMPTZ;
BEGIN
  SELECT checksum, external_updated_at
  INTO v_current_checksum, v_current_updated_at
  FROM projectnexus.external_documents
  WHERE id = p_external_document_id;

  -- Document has changed if:
  -- 1. Checksum is different, OR
  -- 2. Updated at is newer
  RETURN (
    v_current_checksum IS DISTINCT FROM p_new_checksum
    OR v_current_updated_at < p_new_updated_at
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_external_document_changed IS 'Returns true if an external document has changed since last sync';
