-- Migration: Multi-Source RAG - External Documents
-- Stores documents ingested from external data sources

-- Table: external_documents
-- Tracks documents synced from external sources with change detection
CREATE TABLE IF NOT EXISTS projectnexus.external_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES projectnexus.data_sources(id) ON DELETE CASCADE,

  -- External identifier (unique per source)
  external_id TEXT NOT NULL,
  external_url TEXT,

  -- Document metadata from source
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT,
  author_name TEXT,
  author_email TEXT,

  -- Source-specific metadata
  source_metadata JSONB DEFAULT '{}',
  -- Examples:
  -- Confluence: {"spaceKey": "ENG", "pageId": "12345", "version": 5}
  -- Notion: {"databaseId": "xxx", "parentId": "yyy", "lastEditedBy": "zzz"}
  -- SharePoint: {"libraryName": "Documents", "fileExtension": ".docx"}

  -- Change tracking for incremental sync
  external_updated_at TIMESTAMPTZ,
  external_version TEXT,
  checksum TEXT, -- SHA-256 of content for change detection

  -- Processing status
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
    'pending', 'processing', 'indexed', 'failed', 'deleted'
  )),
  indexed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Timestamps
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Ensure external_id is unique per data source
  CONSTRAINT external_documents_unique_external UNIQUE(data_source_id, external_id)
);

-- Indexes for external_documents
CREATE INDEX IF NOT EXISTS idx_external_docs_data_source ON projectnexus.external_documents(data_source_id);
CREATE INDEX IF NOT EXISTS idx_external_docs_external_id ON projectnexus.external_documents(external_id);
CREATE INDEX IF NOT EXISTS idx_external_docs_sync_status ON projectnexus.external_documents(sync_status);
CREATE INDEX IF NOT EXISTS idx_external_docs_updated_at ON projectnexus.external_documents(external_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_docs_deleted_at ON projectnexus.external_documents(deleted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_external_docs_source_metadata ON projectnexus.external_documents
  USING GIN(source_metadata);

-- Index for finding documents needing sync (changed since last sync)
CREATE INDEX IF NOT EXISTS idx_external_docs_sync_pending ON projectnexus.external_documents(data_source_id, external_updated_at DESC)
  WHERE sync_status != 'deleted' AND deleted_at IS NULL;

-- Comments
COMMENT ON TABLE projectnexus.external_documents IS 'Documents ingested from external data sources';
COMMENT ON COLUMN projectnexus.external_documents.external_id IS 'Unique identifier from the external source (e.g., page ID, file ID)';
COMMENT ON COLUMN projectnexus.external_documents.checksum IS 'SHA-256 hash for detecting content changes';
COMMENT ON COLUMN projectnexus.external_documents.sync_status IS 'pending=not indexed, processing=indexing, indexed=in Qdrant, failed=error, deleted=removed from source';
COMMENT ON COLUMN projectnexus.external_documents.source_metadata IS 'Source-specific fields (space keys, versions, etc.)';

-- Trigger to update last_updated_at
CREATE OR REPLACE FUNCTION update_external_documents_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_external_documents_last_updated_at
  BEFORE UPDATE ON projectnexus.external_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_external_documents_last_updated_at();
