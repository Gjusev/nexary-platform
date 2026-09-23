-- Migration: Multi-Source RAG - External Document ACLs
-- Stores permission mappings from external sources to internal users/teams

-- Table: external_document_acls
-- Maps external permissions to internal user/team permissions for query-time filtering
CREATE TABLE IF NOT EXISTS projectnexus.external_document_acls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_document_id UUID NOT NULL REFERENCES projectnexus.external_documents(id) ON DELETE CASCADE,

  -- Source-native permission
  source_type TEXT NOT NULL,
  source_principal_id TEXT NOT NULL,
  -- Examples:
  -- Confluence: user account ID or group name
  -- Notion: user ID
  -- Slack: user ID
  -- SharePoint: user or group ID

  -- Permission level from external source
  permission_level TEXT NOT NULL CHECK (permission_level IN (
    'read', 'write', 'admin', 'owner', 'none'
  )),

  -- Mapped internal user/team (for query-time filtering)
  mapped_user_id TEXT,
  mapped_team_slug TEXT,

  -- Validity period
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Additional metadata
  source_metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT external_acls_unique_mapping UNIQUE(external_document_id, source_principal_id)
);

-- Indexes for external_document_acls
CREATE INDEX IF NOT EXISTS idx_external_acls_document ON projectnexus.external_document_acls(external_document_id);
CREATE INDEX IF NOT EXISTS idx_external_acls_principal ON projectnexus.external_document_acls(source_principal_id);
CREATE INDEX IF NOT EXISTS idx_external_acls_mapped_user ON projectnexus.external_document_acls(mapped_user_id);
CREATE INDEX IF NOT EXISTS idx_external_acls_mapped_team ON projectnexus.external_document_acls(mapped_team_slug);
CREATE INDEX IF NOT EXISTS idx_external_acls_source_type ON projectnexus.external_document_acls(source_type);
CREATE INDEX IF NOT EXISTS idx_external_acls_validity ON projectnexus.external_document_acls(revoked_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_external_acls_permission_level ON projectnexus.external_document_acls(permission_level);

-- Index for checking user access to documents
CREATE INDEX IF NOT EXISTS idx_external_acls_user_access ON projectnexus.external_document_acls(mapped_user_id, revoked_at)
  WHERE revoked_at IS NULL;

-- Index for checking team access to documents
CREATE INDEX IF NOT EXISTS idx_external_acls_team_access ON projectnexus.external_document_acls(mapped_team_slug, revoked_at)
  WHERE revoked_at IS NULL;

-- Comments
COMMENT ON TABLE projectnexus.external_document_acls IS 'Permission mappings from external sources to internal users/teams';
COMMENT ON COLUMN projectnexus.external_document_acls.source_principal_id IS 'User/group ID from the external source (e.g., Confluence account ID)';
COMMENT ON COLUMN projectnexus.external_document_acls.mapped_user_id IS 'Internal user ID this permission maps to';
COMMENT ON COLUMN projectnexus.external_document_acls.mapped_team_slug IS 'Internal team slug this permission maps to';
COMMENT ON COLUMN projectnexus.external_document_acls.revoked_at IS 'If set, this permission has been revoked and should not be used for filtering';

-- View for active ACLs (non-revoked)
CREATE OR REPLACE VIEW projectnexus.v_active_external_acls AS
SELECT
  acl.id,
  acl.external_document_id,
  ed.external_id,
  ed.title AS document_title,
  ds.team_slug,
  ds.source_type,
  acl.source_principal_id,
  acl.permission_level,
  acl.mapped_user_id,
  acl.mapped_team_slug,
  acl.granted_at,
  acl.synced_at
FROM projectnexus.external_document_acls acl
JOIN projectnexus.external_documents ed ON ed.id = acl.external_document_id
JOIN projectnexus.data_sources ds ON ds.id = ed.data_source_id
WHERE acl.revoked_at IS NULL
  AND ed.deleted_at IS NULL
  AND ed.sync_status = 'indexed';

COMMENT ON VIEW projectnexus.v_active_external_acls IS 'Active (non-revoked) ACL mappings for query-time permission filtering';

-- View for unmapped ACLs (needs manual mapping)
CREATE OR REPLACE VIEW projectnexus.v_unmapped_external_acls AS
SELECT
  acl.id,
  ds.team_slug,
  ds.name AS data_source_name,
  ds.source_type,
  acl.external_document_id,
  ed.external_id,
  ed.title AS document_title,
  acl.source_principal_id,
  acl.permission_level,
  acl.synced_at
FROM projectnexus.external_document_acls acl
JOIN projectnexus.external_documents ed ON ed.id = acl.external_document_id
JOIN projectnexus.data_sources ds ON ds.id = ed.data_source_id
WHERE acl.mapped_user_id IS NULL
  AND acl.mapped_team_slug IS NULL
  AND acl.revoked_at IS NULL
ORDER BY acl.synced_at DESC;

COMMENT ON VIEW projectnexus.v_unmapped_external_acls IS 'External ACLs that need manual mapping to internal users/teams';
