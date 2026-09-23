-- Migration: Team API Keys
-- Enables programmatic access to team resources via API keys

-- Table: team_api_keys
-- Stores API keys for team integrations and automation
CREATE TABLE IF NOT EXISTS projectnexus.team_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Creator of the API key
  name TEXT NOT NULL, -- Human-readable name for the key
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (e.g., "nxak_...")
  scopes TEXT[] NOT NULL DEFAULT '{}', -- Array of scopes: ['read:chat', 'write:chat', 'read:documents', etc.]
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Optional expiration date
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_team_api_keys_team
    FOREIGN KEY (team_slug)
    REFERENCES projectnexus.teams(slug)
    ON DELETE CASCADE
);

-- Indexes for team_api_keys
CREATE INDEX IF NOT EXISTS idx_team_api_keys_team_slug ON projectnexus.team_api_keys(team_slug);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_user_id ON projectnexus.team_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_key_hash ON projectnexus.team_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_is_active ON projectnexus.team_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_created_at ON projectnexus.team_api_keys(created_at DESC);

-- Table: team_api_key_usage
-- Tracks API key usage for analytics and rate limiting
CREATE TABLE IF NOT EXISTS projectnexus.team_api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES projectnexus.team_api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- e.g., '/api/chat/conversations/{id}/stream'
  method TEXT NOT NULL, -- e.g., 'POST', 'GET'
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  user_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_team_api_key_usage_api_key_id ON projectnexus.team_api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_team_api_key_usage_created_at ON projectnexus.team_api_key_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_api_key_usage_endpoint ON projectnexus.team_api_key_usage(endpoint);

-- Comments
COMMENT ON TABLE projectnexus.team_api_keys IS 'API keys for programmatic access to team resources';
COMMENT ON TABLE projectnexus.team_api_key_usage IS 'API key usage logs for analytics and rate limiting';
COMMENT ON COLUMN projectnexus.team_api_keys.key_hash IS 'SHA-256 hash of the full API key for secure storage';
COMMENT ON COLUMN projectnexus.team_api_keys.key_prefix IS 'First 8 characters of the key for identification';
COMMENT ON COLUMN projectnexus.team_api_keys.scopes IS 'Access scopes: read:chat, write:chat, read:documents, write:documents, admin, etc.';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_team_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_team_api_keys_updated_at
  BEFORE UPDATE ON projectnexus.team_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_team_api_keys_updated_at();
