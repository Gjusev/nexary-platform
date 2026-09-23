# Database Schema Documentation

## Overview

Nexary uses PostgreSQL as its primary database with a schema named `projectnexus`. All tables are automatically created on application startup via the `ensureTables()` function in `lib/db.ts`.

## Schema Organization

```
projectnexus schema
├── Authentication & Authorization
│   ├── role_permissions
│   ├── role_assignments
│   ├── api_keys
│   ├── api_key_usage_logs
│   ├── saml_configurations
│   ├── saml_audit_logs
│   ├── scim_tokens
│   └── scim_sync_logs
│
├── Teams & Collaboration
│   ├── teams
│   ├── team_members
│   ├── team_member_logs
│   ├── team_invitations
│   ├── team_join_requests
│   └── team_invitation_links
│
├── Chat System
│   ├── chat_conversations
│   ├── chat_messages
│   ├── chat_threads (legacy)
│   ├── chat_documents
│   └── chat_embeddings
│
├── RAG System
│   ├── rag_packages
│   ├── rag_documents
│   ├── rag_document_versions
│   ├── rag_chunks
│   ├── rag_team_assignments
│   └── rag_user_assignments
│
├── Documents
│   └── documents (centralized document hub)
│
├── Compliance
│   ├── consent_records
│   ├── gdpr_requests
│   ├── retention_policies
│   ├── retention_jobs
│   ├── data_regions
│   ├── team_data_residency
│   ├── cross_region_access_logs
│   ├── phi_access_logs
│   ├── phi_resources
│   ├── baa_agreements
│   ├── hipaa_risk_assessments
│   ├── compliance_reports
│   ├── stgb203_immutable_audit_logs
│   ├── legal_resources
│   ├── legal_matters
│   ├── verified_professionals
│   ├── legal_holds
│   └── legal_hold_preservations
│
├── Billing & Usage
│   ├── plans
│   ├── team_subscriptions
│   ├── entitlements
│   ├── usage_counters
│   └── usage_events
│
└── Audit & Monitoring
    └── audit_logs
```

## Table Definitions

### Authentication & Authorization

#### `role_permissions`
Maps roles to their corresponding permissions.

```sql
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) NOT NULL UNIQUE,
    permissions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Fields**:
- `role_name`: Unique role identifier (e.g., 'admin', 'team-owner')
- `permissions`: JSON object with permission keys and boolean values

**Example**:
```json
{
  "role_name": "team-owner",
  "permissions": {
    "$update_team": true,
    "rag:query": true,
    "rag:ingest": true,
    "rag:update": true,
    "rag:delete": true
  }
}
```

#### `role_assignments`
Assigns roles to users within a team context.

```sql
CREATE TABLE role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    team_id UUID NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID,
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, team_id)
);
```

#### `api_keys`
Programmatic access keys for API authentication.

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    team_id UUID,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);
```

**Security**:
- `key_hash`: SHA-256 hash of the API key (plaintext key never stored)
- `scopes`: Array of permitted operations (e.g., ['chat:read', 'rag:query'])

#### `api_key_usage_logs`
Audit trail for API key usage.

```sql
CREATE TABLE api_key_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id),
    user_id UUID,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address INET,
    user_agent TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Teams & Collaboration

#### `teams`
Core team/organization entity.

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `team_members`
Team membership with roles.

```sql
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('team-owner', 'team-leader', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);
```

**Roles**:
- `team-owner`: Full control, can delete team
- `team-leader`: Can manage members and resources
- `member`: Basic access to team resources

#### `team_member_logs`
Audit trail for membership changes.

```sql
CREATE TABLE team_member_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    previous_role VARCHAR(50),
    new_role VARCHAR(50),
    performed_by UUID,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `team_invitations`
One-time invitation codes.

```sql
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
```

#### `team_join_requests`
User-initiated join requests.

```sql
CREATE TABLE team_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ
);
```

### Chat System

#### `chat_conversations`
Chat session metadata.

```sql
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    team_id UUID,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    model_id VARCHAR(100),
    rag_package_ids JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features**:
- `slug`: URL-friendly identifier for sharing
- `rag_package_ids`: Array of RAG packages to include in context
- `metadata`: Flexible storage for UI settings, etc.

#### `chat_messages`
Individual messages in conversations.

```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Roles**:
- `user`: Human messages
- `assistant`: AI responses
- `system`: System messages (context, instructions)

#### `chat_documents`
Temporary documents uploaded for chat context.

```sql
CREATE TABLE chat_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RAG System

#### `rag_packages`
Knowledge base packages.

```sql
CREATE TABLE rag_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('team', 'global')),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

**Scopes**:
- `team`: Only accessible to team members
- `global`: Accessible across teams (admin only)

#### `rag_documents`
Documents within RAG packages.

```sql
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES rag_packages(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    chunk_count INTEGER DEFAULT 0,
    storage_key VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

#### `rag_chunks`
Text chunks with full-text search.

```sql
CREATE TABLE rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    vector_id VARCHAR(255),
    FULLTEXT(content)
);
```

**Full-Text Search**:
- Uses PostgreSQL FULLTEXT index for BM25 scoring
- Combined with vector search for hybrid retrieval

#### `rag_team_assignments`
Team-level permissions for RAG packages.

```sql
CREATE TABLE rag_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES rag_packages(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    permissions JSONB NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID,
    UNIQUE(package_id, team_id)
);
```

#### `rag_user_assignments`
User-specific permissions (override team permissions).

```sql
CREATE TABLE rag_user_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES rag_packages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    permissions JSONB NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID,
    UNIQUE(package_id, user_id)
);
```

### Compliance

#### `consent_records`
GDPR consent tracking.

```sql
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    purpose TEXT NOT NULL,
    consent BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    metadata JSONB DEFAULT '{}'
);
```

#### `gdpr_requests`
GDPR data subject requests.

```sql
CREATE TABLE gdpr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('access', 'erasure', 'portability')),
    status VARCHAR(20) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    results JSONB,
    metadata JSONB DEFAULT '{}'
);
```

#### `stgb203_immutable_audit_logs`
Immutable audit logs for legal sector (§203 StGB).

```sql
CREATE TABLE stgb203_immutable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    performed_by UUID,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    metadata JSONB DEFAULT '{}'
);
```

**Requirements**:
- 10-year retention (no deletion allowed)
- Cryptographically sealed (append-only)
- Tamper-evident (blockchain-style hashing)

### Billing & Usage

#### `plans`
Subscription plans with limits.

```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    limits JSONB NOT NULL,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example Limits**:
```json
{
  "messages_per_month": 10000,
  "rag_storage_gb": 100,
  "team_members": 50,
  "api_requests_per_hour": 1000
}
```

#### `usage_events`
Individual usage events for aggregation.

```sql
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    user_id UUID,
    event_type VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Indexes

### Performance Indexes
```sql
-- Chat
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id, updated_at DESC);

-- RAG
CREATE INDEX idx_rag_documents_package ON rag_documents(package_id, deleted_at);
CREATE INDEX idx_rag_chunks_document ON rag_chunks(document_id);
CREATE INDEX idx_rag_chunks_content ON rag_chunks USING gin(to_tsvector('english', content));

-- Teams
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- Compliance
CREATE INDEX idx_consent_records_user_timestamp ON consent_records(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, created_at DESC);
```

## Constraints & Relationships

### Foreign Key Cascades
```sql
-- Team deletion cascades to related records
ON DELETE CASCADE for:
  - team_members
  - team_invitations
  - rag_packages (team-scoped)

-- Conversation deletion cascades to messages
ON DELETE CASCADE for:
  - chat_messages
  - chat_documents
```

### Unique Constraints
```sql
UNIQUE(team_id, user_id) for team_members
UNIQUE(team_id, user_id) for role_assignments
UNIQUE(package_id, team_id) for rag_team_assignments
UNIQUE(package_id, user_id) for rag_user_assignments
```

## Data Retention

### Retention Policies

| Table | Retention Period | Cleanup Method |
|-------|------------------|----------------|
| `audit_logs` | 1 year | Automated job |
| `usage_events` | 90 days | Aggregation then delete |
| `api_key_usage_logs` | 180 days | Automated cleanup |
| `chat_messages` | User-controlled | Soft delete |
| `rag_documents` | User-controlled | Trash then permanent delete |
| `stgb203_immutable_audit_logs` | 10 years | Never delete |

### Automated Cleanup
```sql
-- Example retention job
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year'
AND status = 'resolved';
```

## Migration Strategy

### Version Control
- All schema changes tracked in `migrations/` directory
- Migration files named: `YYYYMMDD_description.sql`
- Rollback scripts included for each migration

### Deployment Process
1. Test migrations on staging database
2. Create backup before production migration
3. Run migrations during maintenance window
4. Verify post-migration data integrity
5. Monitor for performance degradation

## Backup & Recovery

### Backup Strategy
- **Full Backups**: Daily at 2 AM UTC
- **Incremental**: Every hour
- **Retention**: 30 days
- **Storage**: Cross-region (replicated)

### Recovery
```bash
# Restore from backup
pg_restore -d projectnexus backup.dump

# Point-in-time recovery
pg_ctl start -o "-c recovery_target_time='2025-01-01 12:00:00'"
```

## Security Considerations

### Data Classification
- **Public**: Team names, descriptions
- **Internal**: User IDs, team memberships
- **Confidential**: Chat content, document content
- **Restricted**: API keys, session tokens

### Encryption
- **At Rest**: Transparent Data Encryption (TDE)
- **In Transit**: TLS 1.3
- **Backup**: AES-256 encrypted backups

### Access Control
- **Database Users**: Separate roles for app, admin, read-only
- **Connection Security**: Force SSL connections
- **Privilege Management**: Principle of least privilege
