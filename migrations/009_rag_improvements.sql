BEGIN;

-- =====================================================
-- RAG Document Management Improvements
-- Migration 009: Enhanced document management features
-- =====================================================

-- 1. Add new columns to existing rag_documents table
ALTER TABLE projectnexus.rag_documents
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_document_id UUID,
  ADD COLUMN IF NOT EXISTS query_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_queried_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add constraint for status (do it separately to allow for existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_status_check'
  ) THEN
    ALTER TABLE projectnexus.rag_documents
      ADD CONSTRAINT rag_documents_status_check 
      CHECK (status IN ('uploading', 'processing', 'ready', 'failed'));
  END IF;
END$$;

-- Add foreign key for version history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_parent_fk'
  ) THEN
    ALTER TABLE projectnexus.rag_documents
      ADD CONSTRAINT rag_documents_parent_fk 
      FOREIGN KEY (parent_document_id) REFERENCES projectnexus.rag_documents(id);
  END IF;
END$$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_rag_documents_tags ON projectnexus.rag_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON projectnexus.rag_documents(status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_archived ON projectnexus.rag_documents(archived_at);
CREATE INDEX IF NOT EXISTS idx_rag_documents_query_count ON projectnexus.rag_documents(query_count DESC);

-- =====================================================
-- NEW: Master documents table (documents independent of RAG packages)
-- This enables documents to be shared across multiple RAG packages
CREATE TABLE IF NOT EXISTS projectnexus.master_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  -- Storage references
  bucket TEXT,
  object_key TEXT,
  sha256 TEXT,
  -- Extracted text cache
  extracted_text TEXT,
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Indexes for master_documents
CREATE INDEX IF NOT EXISTS idx_master_documents_team ON projectnexus.master_documents(team_slug);
CREATE INDEX IF NOT EXISTS idx_master_documents_user ON projectnexus.master_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_master_documents_status ON projectnexus.master_documents(status);
CREATE INDEX IF NOT EXISTS idx_master_documents_tags ON projectnexus.master_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_master_documents_deleted ON projectnexus.master_documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_master_documents_filename ON projectnexus.master_documents(filename);

-- =====================================================
-- 3. Document-RAG Assignments (many-to-many junction)
-- =====================================================

CREATE TABLE IF NOT EXISTS projectnexus.document_rag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_document_id UUID NOT NULL REFERENCES projectnexus.master_documents(id) ON DELETE CASCADE,
  rag_package_id UUID NOT NULL REFERENCES projectnexus.rag_packages(id) ON DELETE CASCADE,
  -- Processing state per RAG assignment
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  point_ids TEXT[] DEFAULT '{}',
  error_message TEXT,
  -- Analytics
  query_count INTEGER NOT NULL DEFAULT 0,
  last_queried_at TIMESTAMPTZ,
  -- Timestamps
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  assigned_by TEXT,
  -- Unique constraint
  UNIQUE(master_document_id, rag_package_id)
);

-- Indexes for assignments
CREATE INDEX IF NOT EXISTS idx_doc_rag_assignments_doc ON projectnexus.document_rag_assignments(master_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_rag_assignments_rag ON projectnexus.document_rag_assignments(rag_package_id);
CREATE INDEX IF NOT EXISTS idx_doc_rag_assignments_status ON projectnexus.document_rag_assignments(status);

-- =====================================================
-- 4. Document analytics view (helper)
-- =====================================================

CREATE OR REPLACE VIEW projectnexus.document_analytics AS
SELECT 
  md.id,
  md.filename,
  md.team_slug,
  md.created_at,
  md.status,
  COUNT(dra.id) AS rag_count,
  COALESCE(SUM(dra.query_count), 0) AS total_queries,
  MAX(dra.last_queried_at) AS last_queried_at,
  COALESCE(SUM(dra.chunk_count), 0) AS total_chunks
FROM projectnexus.master_documents md
LEFT JOIN projectnexus.document_rag_assignments dra ON dra.master_document_id = md.id
WHERE md.deleted_at IS NULL
GROUP BY md.id, md.filename, md.team_slug, md.created_at, md.status;

COMMIT;
