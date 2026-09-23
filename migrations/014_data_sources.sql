-- Migration: Multi-Source RAG - Data Sources
-- Enables integration with external data sources (Confluence, Notion, SharePoint, etc.)

-- Table: data_sources
-- Stores configuration for external data source connections
CREATE TABLE IF NOT EXISTS projectnexus.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  name TEXT NOT NULL, -- Human-readable name for the data source (e.g., "Company Wiki")
  source_type TEXT NOT NULL CHECK (source_type IN (
    'confluence', 'notion', 'sharepoint', 'google_drive',
    'slack', 'web', 'database', 'rss', 'sitemap'
  )),

  -- Connection configuration (encrypted at rest)
  config JSONB NOT NULL DEFAULT '{}',
  -- Example structure:
  -- {
  --   "baseUrl": "https://company.atlassian.net",
  --   "credentials": {
  --     "type": "oauth",
  --     "accessToken": "encrypted_value",
  --     "refreshToken": "encrypted_value"
  --   },
  --   "syncSettings": {
  --     "frequency": "hourly",
  --     "webhookEnabled": true
  --   }
  -- }

  -- Sync configuration
  sync_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'weekly')),
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,

  -- Status and health
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'disabled')),
  last_error TEXT,
  health_check_at TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),

  -- Metadata
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,

  -- Optional: Auto-assign synced documents to specific RAG packages
  auto_rag_package_ids TEXT[] DEFAULT '{}',

  CONSTRAINT fk_data_sources_team
    FOREIGN KEY (team_slug)
    REFERENCES projectnexus.teams(slug)
    ON DELETE CASCADE
);

-- Indexes for data_sources
CREATE INDEX IF NOT EXISTS idx_data_sources_team_slug ON projectnexus.data_sources(team_slug);
CREATE INDEX IF NOT EXISTS idx_data_sources_source_type ON projectnexus.data_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON projectnexus.data_sources(status);
CREATE INDEX IF NOT EXISTS idx_data_sources_next_sync ON projectnexus.data_sources(next_sync_at)
  WHERE sync_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_data_sources_auto_rag ON projectnexus.data_sources
  USING GIN(auto_rag_package_ids);
CREATE INDEX IF NOT EXISTS idx_data_sources_created_at ON projectnexus.data_sources(created_at DESC);

-- Comments
COMMENT ON TABLE projectnexus.data_sources IS 'External data source configurations for multi-source RAG';
COMMENT ON COLUMN projectnexus.data_sources.config IS 'Encrypted connection configuration including credentials';
COMMENT ON COLUMN projectnexus.data_sources.sync_frequency IS 'How often to sync: manual, hourly, daily, weekly';
COMMENT ON COLUMN projectnexus.data_sources.health_status IS 'Last known health status of the connection';
COMMENT ON COLUMN projectnexus.data_sources.auto_rag_package_ids IS 'RAG packages to automatically assign synced documents to';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_data_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_data_sources_updated_at
  BEFORE UPDATE ON projectnexus.data_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_data_sources_updated_at();
