BEGIN;

-- Enable pgcrypto for UUID gen
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema
CREATE SCHEMA IF NOT EXISTS projectnexus;

-- Invitations (codes)
CREATE TABLE IF NOT EXISTS projectnexus.team_invitations (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  used_by TEXT,
  used_at TIMESTAMPTZ,
  notes TEXT
);

-- Team join requests
CREATE TABLE IF NOT EXISTS projectnexus.team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  UNIQUE(team_slug, requester_email)
);

-- RAG packages
CREATE TABLE IF NOT EXISTS projectnexus.rag_packages (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  collection_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  -- access control
  scope TEXT NOT NULL DEFAULT 'team' CHECK (scope IN ('team','global')),
  owner_team_slug TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_packages_team_slug ON projectnexus.rag_packages(team_slug);

-- RAG documents (with object storage + soft delete)
CREATE TABLE IF NOT EXISTS projectnexus.rag_documents (
  id UUID PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES projectnexus.rag_packages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chunk_count INTEGER NOT NULL,
  point_ids TEXT[],
  -- object storage references
  bucket TEXT,
  object_key TEXT,
  etag TEXT,
  sha256 TEXT,
  text_extracted BOOLEAN NOT NULL DEFAULT false,
  -- soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_package ON projectnexus.rag_documents(package_id);
-- Ensure optional columns exist when table was created previously without them
ALTER TABLE IF EXISTS projectnexus.rag_documents
  ADD COLUMN IF NOT EXISTS bucket TEXT,
  ADD COLUMN IF NOT EXISTS object_key TEXT,
  ADD COLUMN IF NOT EXISTS etag TEXT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS text_extracted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;
-- Helpful partial index for active documents
CREATE INDEX IF NOT EXISTS idx_rag_documents_package_active ON projectnexus.rag_documents(package_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rag_documents_deleted_at ON projectnexus.rag_documents(deleted_at);

-- Chat legacy tables
CREATE TABLE IF NOT EXISTS projectnexus.chat_threads (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectnexus.chat_messages_threads (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES projectnexus.chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectnexus.chat_thread_packages (
  thread_id UUID NOT NULL REFERENCES projectnexus.chat_threads(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  PRIMARY KEY (thread_id, package_id)
);

-- Chat v2
CREATE TABLE IF NOT EXISTS projectnexus.chat_conversations (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  user_email TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  rag_package_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectnexus.chat_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES projectnexus.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team management
CREATE TABLE IF NOT EXISTS projectnexus.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectnexus.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES projectnexus.teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('team-owner', 'team-leader', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspended_by TEXT,
  suspension_reason TEXT,
  removed_at TIMESTAMPTZ,
  removed_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS projectnexus.team_member_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES projectnexus.team_members(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectnexus.team_invitation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'used_up')),
  notes TEXT,
  last_used_at TIMESTAMPTZ,
  last_used_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_team ON projectnexus.chat_conversations(user_email, team_slug);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_slug ON projectnexus.chat_conversations(slug);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON projectnexus.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_team_members_team_status ON projectnexus.team_members(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_user_status ON projectnexus.team_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_team_member_logs_member ON projectnexus.team_member_logs(member_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON projectnexus.teams(slug);
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_team_status ON projectnexus.team_invitation_links(team_slug, status);
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_token ON projectnexus.team_invitation_links(token);

-- RBAC
CREATE TABLE IF NOT EXISTS projectnexus.role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS projectnexus.role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RAG access control
CREATE TABLE IF NOT EXISTS projectnexus.rag_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id UUID NOT NULL REFERENCES projectnexus.rag_packages(id) ON DELETE CASCADE,
  team_slug TEXT NOT NULL,
  policy TEXT NOT NULL DEFAULT 'custom' CHECK (policy IN ('read-only','custom')),
  can_query BOOLEAN NOT NULL DEFAULT TRUE,
  can_ingest BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rag_id, team_slug)
);

CREATE INDEX IF NOT EXISTS idx_rag_team_assignments_team ON projectnexus.rag_team_assignments(team_slug);

CREATE TABLE IF NOT EXISTS projectnexus.rag_user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id UUID NOT NULL REFERENCES projectnexus.rag_packages(id) ON DELETE CASCADE,
  team_slug TEXT NOT NULL,
  user_id TEXT NOT NULL,
  can_query BOOLEAN NOT NULL DEFAULT TRUE,
  can_ingest BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rag_id, team_slug, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rag_user_assignments_user ON projectnexus.rag_user_assignments(user_id);

-- Plans, subscriptions and usage
CREATE TABLE IF NOT EXISTS projectnexus.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  limits JSONB NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectnexus.team_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES projectnexus.plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_slug)
);

CREATE TABLE IF NOT EXISTS projectnexus.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_slug, feature_key)
);

CREATE TABLE IF NOT EXISTS projectnexus.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  period TEXT NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_slug, metric_key, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_period ON projectnexus.usage_counters(team_slug, period);

CREATE TABLE IF NOT EXISTS projectnexus.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  rag_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_team_time ON projectnexus.usage_events(team_slug, created_at);

CREATE TABLE IF NOT EXISTS projectnexus.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plan and autosubscribe
INSERT INTO projectnexus.plans (id, name, limits)
VALUES ('free','Free', '{"members":10,"rags":3,"docsProcessed":20000,"queries":5000}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projectnexus.team_subscriptions (team_slug, plan_id)
SELECT t.slug, 'free'
FROM projectnexus.teams t
LEFT JOIN projectnexus.team_subscriptions s ON s.team_slug = t.slug
WHERE s.team_slug IS NULL;

COMMIT;
