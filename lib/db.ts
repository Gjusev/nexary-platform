import { Pool, type QueryResult, type QueryResultRow } from 'pg';

// Security: Validate environment variables at module load time
import { getEnv } from './config/env';

// Validate all environment variables on startup
const env = getEnv();

const connectionString = env.DATABASE_URL;

// Security: Optimized connection pool configuration
const pool = new Pool({
  connectionString,
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients to keep in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
  idle_in_transaction_session_timeout: 60000, // Terminate sessions idle in transaction for 60 seconds
});

let initialized = false;

async function ensureTables() {
  // Ensure pgcrypto for UUID generation
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  // Create schema if it doesn't exist
  await pool.query(`CREATE SCHEMA IF NOT EXISTS projectnexus`);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.rag_packages (
      id UUID PRIMARY KEY,
      team_slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      collection_name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_packages_team_slug ON projectnexus.rag_packages(team_slug)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.rag_documents (
      id UUID PRIMARY KEY,
      package_id UUID NOT NULL REFERENCES projectnexus.rag_packages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      size BIGINT NOT NULL,
      content_type TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      chunk_count INTEGER NOT NULL,
      point_ids TEXT[]
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_documents_package ON projectnexus.rag_documents(package_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_threads (
      id UUID PRIMARY KEY,
      team_slug TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_messages_threads (
      id UUID PRIMARY KEY,
      thread_id UUID NOT NULL REFERENCES projectnexus.chat_threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_thread_packages (
      thread_id UUID NOT NULL REFERENCES projectnexus.chat_threads(id) ON DELETE CASCADE,
      package_id TEXT NOT NULL,
      PRIMARY KEY (thread_id, package_id)
    )
  `);

  // New chat conversations with slug support
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_conversations (
      id UUID PRIMARY KEY,
      slug VARCHAR(255) UNIQUE NOT NULL,
      user_email TEXT NOT NULL,
      team_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      rag_package_ids TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_messages (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES projectnexus.chat_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Chat documents (for temporary uploads)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_documents (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES projectnexus.chat_conversations(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      user_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Enable pgvector extension if not exists
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  // Chat embeddings (for RAG on uploaded documents)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.chat_embeddings (
      id UUID PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES projectnexus.chat_documents(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES projectnexus.chat_conversations(id) ON DELETE CASCADE,
      chunk_text TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      embedding vector(3072),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Team management tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add enterprise SSO columns to teams table
  await pool.query(`
    ALTER TABLE projectnexus.teams
    ADD COLUMN IF NOT EXISTS sso_type TEXT DEFAULT 'none'
      CHECK (sso_type IN ('none', 'saml', 'oidc', 'both'))
  `);

  await pool.query(`
    ALTER TABLE projectnexus.teams
    ADD COLUMN IF NOT EXISTS enterprise_auth_enabled BOOLEAN DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE projectnexus.teams
    ADD COLUMN IF NOT EXISTS corporate_domain TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_teams_corporate_domain
    ON projectnexus.teams(corporate_domain)
    WHERE corporate_domain IS NOT NULL
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.team_member_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES projectnexus.team_members(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT,
      performed_by TEXT NOT NULL,
      performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
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
    )
  `);

  // Create indexes after all tables are created
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_team 
    ON projectnexus.chat_conversations(user_email, team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_slug 
    ON projectnexus.chat_conversations(slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation 
    ON projectnexus.chat_messages(conversation_id, created_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_members_team_status 
    ON projectnexus.team_members(team_id, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_members_user_status 
    ON projectnexus.team_members(user_id, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_member_logs_member 
    ON projectnexus.team_member_logs(member_id, performed_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_teams_slug 
    ON projectnexus.teams(slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_invitation_links_team_status 
    ON projectnexus.team_invitation_links(team_slug, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_invitation_links_token 
    ON projectnexus.team_invitation_links(token)
  `);

  // Optional columns for object storage references (MinIO/S3) on rag_documents
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.rag_documents
    ADD COLUMN IF NOT EXISTS bucket TEXT,
    ADD COLUMN IF NOT EXISTS object_key TEXT,
    ADD COLUMN IF NOT EXISTS etag TEXT,
    ADD COLUMN IF NOT EXISTS sha256 TEXT,
    ADD COLUMN IF NOT EXISTS text_extracted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT,
    ADD COLUMN IF NOT EXISTS uploaded_by TEXT,
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS file_size BIGINT
  `);

  // Soft delete support for rag_packages
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.rag_packages
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by TEXT
  `);

  // Add user_id column to chat_conversations for GDPR compliance
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.chat_conversations
    ADD COLUMN IF NOT EXISTS user_id TEXT
  `);

  // Add user_id column to chat_messages for GDPR compliance
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.chat_messages
    ADD COLUMN IF NOT EXISTS user_id TEXT
  `);

  // RBAC global roles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.role_permissions (
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      PRIMARY KEY (role, permission)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.role_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // RAG access control
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.rag_packages 
      ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'team' CHECK (scope IN ('team','global')),
      ADD COLUMN IF NOT EXISTS owner_team_slug TEXT NULL
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_team_assignments_team ON projectnexus.rag_team_assignments(team_slug)
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_user_assignments_user ON projectnexus.rag_user_assignments(user_id)
  `);

  // Plans, subscriptions and usage
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      limits JSONB NOT NULL,
      features JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.team_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      plan_id TEXT NOT NULL REFERENCES projectnexus.plans(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled')),
      current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '30 days'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (team_slug)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.entitlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      feature_key TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (team_slug, feature_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.usage_counters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      period TEXT NOT NULL,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (team_slug, metric_key, period)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_usage_counters_period ON projectnexus.usage_counters(team_slug, period)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.usage_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL,
      rag_id UUID,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_usage_events_team_time ON projectnexus.usage_events(team_slug, created_at)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Ensure audit_logs has new columns (migration for existing)
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.audit_logs
    ADD COLUMN IF NOT EXISTS ip_address TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT
  `);

  // Seed a default 'free' plan and auto-subscribe existing teams if missing
  await pool.query(`
    INSERT INTO projectnexus.plans (id, name, limits)
    VALUES ('free','Free', '{"members":10,"rags":3,"docsProcessed":20000,"queries":5000}')
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO projectnexus.team_subscriptions (team_slug, plan_id)
    SELECT t.slug, 'free'
    FROM projectnexus.teams t
    LEFT JOIN projectnexus.team_subscriptions s ON s.team_slug = t.slug
    WHERE s.team_slug IS NULL
  `);

  // SAML SSO tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.saml_configurations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      idp_entity_id TEXT NOT NULL,
      idp_sso_url TEXT NOT NULL,
      idp_slo_url TEXT,
      idp_x509_cert TEXT NOT NULL,
      sp_entity_id TEXT NOT NULL,
      acs_url TEXT NOT NULL,
      slo_url TEXT,
      name_id_format TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      attribute_mapping JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_slug)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_config_team ON projectnexus.saml_configurations(team_slug)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.saml_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      user_id TEXT,
      saml_response_id TEXT,
      authn_request_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'denied')),
      error_message TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_audit_team ON projectnexus.saml_audit_logs(team_slug, created_at)
  `);

  // SCIM 2.0 Provisioning tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.scim_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_used TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scim_tokens_team ON projectnexus.scim_tokens(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scim_tokens_hash ON projectnexus.scim_tokens(token_hash)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.scim_sync_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'patch')),
      resource_type TEXT NOT NULL CHECK (resource_type IN ('User', 'Group')),
      resource_id TEXT,
      scim_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scim_sync_team ON projectnexus.scim_sync_logs(team_slug, created_at)
  `);

  // ============================================

// API Keys table for programmatic access
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      scopes TEXT[] NOT NULL DEFAULT '{}',
      last_used TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_team ON projectnexus.api_keys(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON projectnexus.api_keys(key_hash)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON projectnexus.api_keys(user_id)
  `);

  // API Keys usage audit log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.api_key_usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_key_id UUID NOT NULL REFERENCES projectnexus.api_keys(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON projectnexus.api_key_usage_logs(api_key_id, created_at)
  `);

  // GDPR Consent tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.consent_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      consent_type TEXT NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'cookies', 'third_party_sharing', 'email_communications')),
      granted BOOLEAN NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      withdrawn_at TIMESTAMPTZ,
      consent_version TEXT NOT NULL DEFAULT '1.0',
      ip_address INET,
      user_agent TEXT,
      metadata JSONB DEFAULT '{}'
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_consent_user ON projectnexus.consent_records(user_id, consent_type)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_consent_active ON projectnexus.consent_records(user_id) WHERE withdrawn_at IS NULL
  `);

  // GDPR Data Requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.gdpr_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      request_type TEXT NOT NULL CHECK (request_type IN ('access', 'erasure', 'portability')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      rejection_reason TEXT,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON projectnexus.gdpr_requests(user_id, requested_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON projectnexus.gdpr_requests(status, expires_at)
  `);

  // Data Retention Policies
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.retention_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('chat_messages', 'documents', 'audit_logs', 'api_keys', 'consents', 'scim_logs')),
      retention_period_days INTEGER NOT NULL,
      action_after_retention TEXT NOT NULL CHECK (action_after_retention IN ('delete', 'archive', 'anonymize')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_retention_policies_team ON projectnexus.retention_policies(team_slug, resource_type)
  `);

  // Retention Jobs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.retention_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id UUID NOT NULL REFERENCES projectnexus.retention_policies(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
      scheduled_for TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      records_affected INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_retention_jobs_scheduled ON projectnexus.retention_jobs(scheduled_for, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_retention_jobs_policy ON projectnexus.retention_jobs(policy_id, status)
  `);

  // Data Regions for multi-region deployment
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.data_regions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      database_host TEXT NOT NULL,
      database_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_data_regions_code ON projectnexus.data_regions(code)
  `);

  // Team Data Residency preferences
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.team_data_residency (
      team_slug TEXT NOT NULL PRIMARY KEY REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      preferred_region TEXT NOT NULL REFERENCES projectnexus.data_regions(code) ON DELETE RESTRICT,
      enforced BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Cross-region access logging
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.cross_region_access_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL,
      user_id TEXT NOT NULL,
      source_region TEXT NOT NULL,
      target_region TEXT NOT NULL,
      access_reason TEXT,
      approved_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cross_region_team ON projectnexus.cross_region_access_logs(team_slug, created_at)
  `);

  // HIPAA PHI Access Logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.phi_access_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      phi_resource_id TEXT NOT NULL,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'conversation', 'user_profile', 'team_data', 'audit_log')),
      access_type TEXT NOT NULL CHECK (access_type IN ('view', 'edit', 'delete', 'export', 'share')),
      purpose TEXT NOT NULL CHECK (purpose IN ('treatment', 'payment', 'healthcare_operations', 'research', 'public_health', 'other')),
      purpose_details TEXT,
      authorized_by TEXT,
      team_slug TEXT,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_phi_access_user ON projectnexus.phi_access_logs(user_id, created_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_phi_access_resource ON projectnexus.phi_access_logs(phi_resource_id, created_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_phi_access_team ON projectnexus.phi_access_logs(team_slug, created_at)
  `);

  // HIPAA PHI Resources tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.phi_resources (
      id TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'conversation', 'user_profile', 'team_data', 'audit_log')),
      team_slug TEXT,
      contains_phi BOOLEAN NOT NULL DEFAULT false,
      last_accessed_at TIMESTAMPTZ,
      access_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_phi_resources_team ON projectnexus.phi_resources(team_slug, contains_phi)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_phi_resources_accessed ON projectnexus.phi_resources(last_accessed_at DESC)
  `);

  // HIPAA Business Associate Agreements (BAA)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.baa_agreements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      vendor_name TEXT NOT NULL,
      vendor_contact_email TEXT NOT NULL,
      effective_date TIMESTAMPTZ NOT NULL,
      expiration_date TIMESTAMPTZ,
      status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'terminated')) DEFAULT 'active',
      document_url TEXT,
      terms TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_baa_team ON projectnexus.baa_agreements(team_slug, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_baa_expiration ON projectnexus.baa_agreements(expiration_date)
  `);

  // HIPAA Risk Assessments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.hipaa_risk_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      title TEXT NOT NULL,
      threat_type TEXT NOT NULL CHECK (threat_type IN ('unauthorized_access', 'data_loss', 'interception', 'integrity_violation', 'availability_loss')),
      likelihood TEXT NOT NULL CHECK (likelihood IN ('low', 'medium', 'high')),
      impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
      risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
      mitigation_measures JSONB NOT NULL DEFAULT '[]',
      implementation_status TEXT NOT NULL CHECK (implementation_status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
      last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      next_review_date TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hipaa_risk_team ON projectnexus.hipaa_risk_assessments(team_slug, risk_level)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hipaa_risk_review ON projectnexus.hipaa_risk_assessments(next_review_date)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hipaa_risk_status ON projectnexus.hipaa_risk_assessments(implementation_status)
  `);

  // SAML Configurations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.saml_configurations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      idp_entity_id TEXT NOT NULL,
      idp_sso_url TEXT NOT NULL,
      idp_slo_url TEXT,
      idp_x509_cert TEXT NOT NULL,
      sp_entity_id TEXT NOT NULL,
      acs_url TEXT NOT NULL,
      slo_url TEXT,
      name_id_format TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      attribute_mapping JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_slug)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_config_team ON projectnexus.saml_configurations(team_slug)
  `);

  // SAML Audit Logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.saml_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      user_id TEXT,
      saml_response_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'denied')),
      error_message TEXT,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_audit_team ON projectnexus.saml_audit_logs(team_slug, created_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_audit_status ON projectnexus.saml_audit_logs(status, created_at)
  `);

  // Compliance Reports
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.compliance_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      framework TEXT NOT NULL CHECK (framework IN ('gdpr', 'soc2', 'hipaa')),
      period TEXT NOT NULL CHECK (period IN ('monthly', 'quarterly', 'annual')),
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      generated_by TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework ON projectnexus.compliance_reports(framework, generated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_reports_period ON projectnexus.compliance_reports(period, generated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_reports_date_range ON projectnexus.compliance_reports(start_date, end_date)
  `);

  // Document Versioning table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.rag_document_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL,
      package_id UUID NOT NULL REFERENCES projectnexus.rag_packages(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      major INTEGER NOT NULL DEFAULT 0,
      minor INTEGER NOT NULL DEFAULT 0,
      patch INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      changes JSONB NOT NULL DEFAULT '[]',
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT true,
      UNIQUE(document_id, version)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_versions_document ON projectnexus.rag_document_versions(document_id, major DESC, minor DESC, patch DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_versions_package ON projectnexus.rag_document_versions(package_id)
  `);

  // RAG Chunks table for full-text search (BM25)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.rag_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      point_id TEXT NOT NULL UNIQUE,
      collection_name TEXT NOT NULL,
      package_id UUID NOT NULL,
      document_id UUID NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      text_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_text_search ON projectnexus.rag_chunks USING gin(text_vector)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_collection ON projectnexus.rag_chunks(collection_name, document_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_package ON projectnexus.rag_chunks(package_id, chunk_index)
  `);

  // Initialize prompts tables
  const { ensurePromptsTable } = await import('./prompts-schema');
  await ensurePromptsTable();

  // ============================================
  // §203 StGB Compliance Tables (Legal Sector)
  // ============================================

  // Immutable 10-year audit logs for §203 StGB compliance
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.stgb203_immutable_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      -- Hash chain for tamper detection
      prev_hash TEXT NOT NULL,
      current_hash TEXT NOT NULL,
      -- Audit data
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      access_type TEXT NOT NULL,
      legal_privilege BOOLEAN NOT NULL DEFAULT false,
      matter_number TEXT,
      -- Metadata
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL,
      details JSONB DEFAULT '{}',
      -- No UPDATE or DELETE permitted - immutable by design
      CONSTRAINT stgb203_no_delete CHECK (true)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_stgb203_user ON projectnexus.stgb203_immutable_audit_logs(user_id, timestamp DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_stgb203_resource ON projectnexus.stgb203_immutable_audit_logs(resource_type, resource_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_stgb203_matter ON projectnexus.stgb203_immutable_audit_logs(matter_number)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_stgb203_timestamp ON projectnexus.stgb203_immutable_audit_logs(timestamp DESC)
  `);

  // Legal resources classification (attorney-client privilege tracking)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.legal_resources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      data_classification TEXT NOT NULL CHECK (data_classification IN ('attorney_client_privilege', 'confidential', 'public')),
      matter_number TEXT,
      client_id TEXT,
      case_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_legal_resource UNIQUE (resource_type, resource_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_resources_classification ON projectnexus.legal_resources(data_classification)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_resources_matter ON projectnexus.legal_resources(matter_number)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_resources_client ON projectnexus.legal_resources(client_id)
  `);

  // Legal matters/cases tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.legal_matters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_number TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      client_name TEXT,
      matter_name TEXT NOT NULL,
      matter_type TEXT CHECK (matter_type IN ('litigation', 'contract', 'advisory', 'investigation', 'other')),
      privilege_level TEXT NOT NULL DEFAULT 'attorney_client' CHECK (privilege_level IN ('attorney_client', 'confidential', 'public')),
      case_status TEXT NOT NULL DEFAULT 'active' CHECK (case_status IN ('active', 'closed', 'archived')),
      legal_hold BOOLEAN NOT NULL DEFAULT false,
      team_slug TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_matters_number ON projectnexus.legal_matters(matter_number)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_matters_client ON projectnexus.legal_matters(client_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_matters_team ON projectnexus.legal_matters(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_matters_status ON projectnexus.legal_matters(case_status)
  `);

  // Professional verification for lawyers, notaries, etc.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.verified_professionals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT UNIQUE NOT NULL,
      profession_type TEXT NOT NULL CHECK (profession_type IN ('lawyer', 'notary', 'attorney', 'legal_assistant', 'other')),
      license_number TEXT UNIQUE,
      bar_association TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      verified_by TEXT,
      verified_at TIMESTAMPTZ,
      verification_documents JSONB DEFAULT '{}',
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_verified_professionals_user ON projectnexus.verified_professionals(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_verified_professionals_status ON projectnexus.verified_professionals(verification_status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_verified_professionals_license ON projectnexus.verified_professionals(license_number)
  `);

  // Legal holds (litigation holds)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.legal_holds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hold_name TEXT NOT NULL,
      hold_type TEXT NOT NULL CHECK (hold_type IN ('litigation', 'investigation', 'regulatory', 'other')),
      matter_number TEXT,
      case_reference TEXT,
      description TEXT,
      scope JSONB NOT NULL DEFAULT '{}',
      hold_status TEXT NOT NULL DEFAULT 'active' CHECK (hold_status IN ('active', 'released', 'expired')),
      team_slug TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      released_at TIMESTAMPTZ,
      released_by TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_holds_team ON projectnexus.legal_holds(team_slug, hold_status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_holds_matter ON projectnexus.legal_holds(matter_number)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_holds_status ON projectnexus.legal_holds(hold_status, created_at DESC)
  `);

  // Legal hold preservations (snapshots of preserved resources)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.legal_hold_preservations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      legal_hold_id UUID NOT NULL REFERENCES projectnexus.legal_holds(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      preserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      snapshot JSONB NOT NULL DEFAULT '{}',
      CONSTRAINT unique_hold_resource UNIQUE (legal_hold_id, resource_type, resource_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_hold_preservations_hold ON projectnexus.legal_hold_preservations(legal_hold_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_legal_hold_preservations_resource ON projectnexus.legal_hold_preservations(resource_type, resource_id)
  `);

  // ============================================
  // OIDC (OpenID Connect) Enterprise Auth Tables
  // ============================================

  // OIDC Configurations per team
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.oidc_configurations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT false,

      -- Authentik/OIDC Provider Configuration
      issuer TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL, -- Store encrypted at rest
      scope TEXT[] NOT NULL DEFAULT ARRAY['openid', 'email', 'profile'],

      -- Endpoints
      authorization_endpoint TEXT NOT NULL,
      token_endpoint TEXT NOT NULL,
      userinfo_endpoint TEXT,
      jwks_uri TEXT NOT NULL,
      end_session_endpoint TEXT,

      -- Security
      pkce BOOLEAN NOT NULL DEFAULT true,
      token_signing_alg TEXT NOT NULL DEFAULT 'RS256',

      -- Claims Mapping
      claims_mapping JSONB DEFAULT '{
        "email": "email",
        "name": "name"
      }'::jsonb,

      -- Metadata
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(team_slug)
    )
  `);

  // Migration: Add missing columns to existing oidc_configurations table
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS authorization_endpoint TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS token_endpoint TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS userinfo_endpoint TEXT
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS jwks_uri TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS end_session_endpoint TEXT
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS token_signing_alg TEXT NOT NULL DEFAULT 'RS256'
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS claims_mapping JSONB DEFAULT '{"email":"email","name":"name"}'::jsonb
  `);

  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.oidc_configurations
      ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_config_team ON projectnexus.oidc_configurations(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_config_enabled ON projectnexus.oidc_configurations(enabled) WHERE enabled = true
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_config_issuer ON projectnexus.oidc_configurations(issuer)
  `);

  // User Identities - Links external IdP identities to Stack Auth users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.user_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,

      -- Identity Provider
      idp_type TEXT NOT NULL CHECK (idp_type IN ('saml', 'oidc')),
      idp_id TEXT NOT NULL, -- Unique identifier from IdP (NameID, sub, etc.)
      idp_issuer TEXT NOT NULL,

      -- User Info
      email TEXT NOT NULL,
      display_name TEXT,
      first_name TEXT,
      last_name TEXT,
      attributes JSONB DEFAULT '{}',

      -- Metadata
      last_authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(team_slug, idp_type, idp_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_identities_user ON projectnexus.user_identities(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_identities_team ON projectnexus.user_identities(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_identities_email ON projectnexus.user_identities(email)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_identities_idp ON projectnexus.user_identities(idp_type, idp_issuer, idp_id)
  `);

  // OIDC Sessions - State/nonce storage for OIDC flow
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.oidc_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,

      -- Security Parameters
      state TEXT NOT NULL UNIQUE,
      nonce TEXT NOT NULL,
      code_verifier TEXT,
      code_challenge_method TEXT,

      -- Flow Control
      return_url TEXT NOT NULL DEFAULT '/dashboard',
      max_age INTEGER NOT NULL DEFAULT 600,

      -- Context
      ip_address TEXT,
      user_agent TEXT,

      -- Status
      consumed BOOLEAN NOT NULL DEFAULT false,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_sessions_state ON projectnexus.oidc_sessions(state)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_sessions_team ON projectnexus.oidc_sessions(team_slug, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_sessions_expires ON projectnexus.oidc_sessions(expires_at) WHERE consumed = false
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_sessions_consumed ON projectnexus.oidc_sessions(consumed, expires_at)
  `);

  // OIDC Audit Logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.oidc_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE,

      -- Event
      event_type TEXT NOT NULL CHECK (event_type IN ('login_initiated', 'login_success', 'login_failed', 'logout', 'token_refresh')),
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'denied')),

      -- User
      user_id TEXT,
      email TEXT,
      identity_id UUID REFERENCES projectnexus.user_identities(id) ON DELETE SET NULL,

      -- OIDC Specific
      oidc_session_id UUID REFERENCES projectnexus.oidc_sessions(id) ON DELETE SET NULL,
      idp_issuer TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,

      -- Context
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB DEFAULT '{}',

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_audit_team ON projectnexus.oidc_audit_logs(team_slug, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_audit_user ON projectnexus.oidc_audit_logs(user_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_audit_session ON projectnexus.oidc_audit_logs(oidc_session_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_oidc_audit_status ON projectnexus.oidc_audit_logs(status, created_at DESC)
  `);

  // SAML to OIDC Migrations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.saml_to_oidc_migrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_slug TEXT NOT NULL REFERENCES projectnexus.teams(slug) ON DELETE CASCADE UNIQUE,

      -- Migration Control
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rolled_back')),
      migration_mode TEXT NOT NULL DEFAULT 'off' CHECK (migration_mode IN ('off', 'shadow', 'canary', 'full')),

      -- Canary Configuration
      canary_percentage INTEGER NOT NULL DEFAULT 0 CHECK (canary_percentage >= 0 AND canary_percentage <= 100),
      canary_user_emails TEXT[] DEFAULT ARRAY[]::TEXT[],

      -- Rollback
      rollback_to_saml BOOLEAN NOT NULL DEFAULT false,
      rollback_reason TEXT,
      rolled_back_at TIMESTAMPTZ,

      -- Timestamps
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_oidc_migration_team ON projectnexus.saml_to_oidc_migrations(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saml_oidc_migration_status ON projectnexus.saml_to_oidc_migrations(status, migration_mode)
  `);

  // ALTER teams table to add SSO configuration
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.teams
    ADD COLUMN IF NOT EXISTS sso_type TEXT NOT NULL DEFAULT 'none' CHECK (sso_type IN ('none', 'saml', 'oidc', 'both')),
    ADD COLUMN IF NOT EXISTS enterprise_auth_enabled BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_teams_sso_type ON projectnexus.teams(sso_type) WHERE enterprise_auth_enabled = true
  `);

  // ALTER saml_configurations table to add migration support
  await pool.query(`
    ALTER TABLE IF EXISTS projectnexus.saml_configurations
    ADD COLUMN IF NOT EXISTS migration_status TEXT DEFAULT 'stable' CHECK (migration_status IN ('stable', 'migrating_to_oidc', 'canary_testing', 'oidc_primary', 'rolled_back'))
  `);

  // Feature Flags table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projectnexus.feature_flags (
      flag TEXT NOT NULL,
      team_slug TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (flag, team_slug)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feature_flags_team ON projectnexus.feature_flags(team_slug)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON projectnexus.feature_flags(flag)
  `);

  // Seed default feature flags
  await pool.query(`
    INSERT INTO projectnexus.feature_flags (flag, team_slug, enabled, value)
    VALUES
      ('OIDC_ENABLED_GLOBAL', NULL, false, 'false'),
      ('OIDC_CANARY_PERCENT', NULL, true, '0'),
      ('OIDC_MIGRATION_MODE', NULL, true, 'off'),
      ('SCIM_ENABLED_GLOBAL', NULL, true, 'true'),
      ('ENTERPRISE_AUTH_ENABLED', NULL, true, 'true')
    ON CONFLICT (flag, team_slug) DO NOTHING
  `);

  initialized = true;
}

export async function initializeTables() {
  if (!initialized) {
    await ensureTables();
  }
}

export async function query<T extends QueryResultRow = any>(text: string, params?: unknown[], package_id?: any, filename?: any, size?: any, content_type?: any, uploaded_at?: any, chunk_count?: any, point_ids?: any, FROM?: any, rag_documents?: any, WHERE?: any, p0?: any, ORDER?: any, BY?: any, DESC?: any, p1?: string[][]): Promise<QueryResult<T>> {
  // Set search path to use our schema by default
  await pool.query('SET search_path TO projectnexus, public');

  // Replace table names in query to use schema-qualified names if not already qualified
  let qualifiedText = text;
  const tableNames = [
    'team_invitations', 'rag_packages', 'rag_documents',
    'chat_threads', 'chat_thread_packages', 'chat_conversations', 'chat_messages',
    'teams', 'team_members', 'team_member_logs', 'team_invitation_links',
    'saml_configurations', 'saml_audit_logs',
    'scim_tokens', 'scim_sync_logs',
    'oidc_configurations', 'user_identities', 'oidc_sessions', 'oidc_audit_logs',
    'saml_to_oidc_migrations',
    'api_keys', 'api_key_usage_logs',
    'consent_records', 'gdpr_requests',
    'retention_policies', 'retention_jobs',
    'data_regions', 'team_data_residency', 'cross_region_access_logs',
    'phi_access_logs', 'phi_resources', 'baa_agreements', 'hipaa_risk_assessments',
    'compliance_reports',
    // §203 StGB Compliance Tables
    'stgb203_immutable_audit_logs',
    'legal_resources',
    'legal_matters',
    'verified_professionals',
    'legal_holds',
    'legal_hold_preservations',
    // OIDC Enterprise Auth Tables
    'oidc_configurations',
    'user_identities',
    'oidc_sessions',
    'oidc_audit_logs',
    'saml_to_oidc_migrations',
    // Feature Flags
    'feature_flags'
  ];

  tableNames.forEach(tableName => {
    // Only replace if not already schema-qualified
    const regex = new RegExp(`\\b(?<!projectnexus\\.)${tableName}\\b`, 'g');
    qualifiedText = qualifiedText.replace(regex, `projectnexus.${tableName}`);
  });

  return pool.query<T>(qualifiedText, params);
}

// Export pool for use in other modules
export { pool };
