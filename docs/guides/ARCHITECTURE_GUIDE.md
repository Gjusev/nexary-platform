# Nexary Application - Complete Architecture Guide

## Table of Contents
1. [Application Overview](#application-overview)
2. [Routing Structure](#routing-structure)
3. [Admin System](#admin-system)
4. [Data Providers & Integrations](#data-providers--integrations)
5. [Processing Pipelines](#processing-pipelines)
6. [Key Components](#key-components)
7. [API Endpoints](#api-endpoints)

---

## Application Overview

**Nexary** is a Next.js 15+ full-stack AI platform featuring:
- Multi-provider AI chat (OpenAI, Google Gemini, Mistral)
- RAG (Retrieval-Augmented Generation) with document processing
- Team-based workspace management
- Internationalization (German, English, Spanish)
- Stack Auth authentication
- PostgreSQL database with Qdrant vector storage
- Redis caching and MinIO object storage

---

## Routing Structure

### Unauthenticated Routes (`app/[locale]/`)

| Route | Purpose | File |
|-------|---------|------|
| `/[locale]/` | Landing page (localized) | `app/[locale]/page.tsx` |
| `/[locale]/login` | Login page | `app/[locale]/login/page.tsx` |
| `/[locale]/register` | Registration | `app/[locale]/register/page.tsx` |
| `/[locale]/about`, `/features`, `/pricing`, `/contact`, `/security` | Marketing pages | `app/[locale]/*/page.tsx` |
| `/[locale]/verify-email` | Email verification | `app/[locale]/verify-email/page.tsx` |

### Authenticated Routes (`app/(authenticated)/`)

| Route | Purpose | File |
|-------|---------|------|
| `/` | Main page (authenticated) | `app/(authenticated)/page.tsx` |
| `/chat` | Chat interface | `app/(authenticated)/chat/chat-layout.tsx` |
| `/chat/[conversationId]` | Specific conversation | `app/(authenticated)/chat/[conversationId]/page.tsx` |
| `/dashboard` | User dashboard | `app/(authenticated)/dashboard/page.tsx` |
| `/dashboard/analytics` | Team analytics | `app/(authenticated)/dashboard/analytics/page.tsx` |
| `/dashboard/documents` | Document management | `app/(authenticated)/dashboard/documents/page.tsx` |
| `/dashboard/rag` | RAG package management | `app/(authenticated)/dashboard/rag/page.tsx` |
| `/dashboard/settings/*` | User settings | `app/(authenticated)/dashboard/settings/*/page.tsx` |
| `/marketplace` | Template marketplace | `app/(authenticated)/marketplace/page.tsx` |

---

## Admin System

### How to Access Admin Functions

#### 1. Become a Global Admin

Admin access requires the `global-admin` role in the database. To assign this role:

**Method 1: Direct Database Assignment**

```sql
INSERT INTO projectnexus.role_assignments (user_id, role)
VALUES ('your-user-id', 'global-admin');
```

**Method 2: Via API (if you have admin access)**

```bash
POST /api/admin/users/assign
{
  "userId": "user-id",
  "role": "global-admin"
}
```

**Method 3: Using the Admin Users Page**

Navigate to `/admin/users` and assign roles via the UI

#### 2. Admin Pages

| Page | URL | Description |
|------|-----|-------------|
| Admin Dashboard | `/admin` | Central hub with navigation |
| Users Management | `/admin/users` | Assign global roles to users |
| Teams Management | `/admin/teams` | View all teams and details |
| RAG Management | `/admin/rags` | Manage all RAG packages |
| RAG User Access | `/admin/rags/users` | User-level RAG permissions |
| Billing Management | `/admin/billing` | Team subscriptions and plan changes |
| Plans Management | `/admin/plans` | Create/edit pricing plans |
| Analytics | `/admin/analytics` | Usage analytics by team |

### Admin Authorization Flow

```
Request → Middleware → Stack Auth Verification → isGlobalAdmin() check → Access Granted/Denied
```

**Frontend Check:**

```typescript
// In admin pages
const { isGlobalAdmin } = useTeam();
if (!isGlobalAdmin) return <AccessDenied />;
```

**Backend Check:**

```typescript
// In API routes
import { isGlobalAdmin } from '@/lib/permissions';
const isAdmin = await isGlobalAdmin(userId);
```

### Admin Roles & Permissions

| Role | Capabilities |
|------|--------------|
| `global-admin` | Full access to all admin features |
| `global-rag-admin` | RAG-specific admin access only |

---

## Data Providers & Integrations

### AI Providers

#### Supported Providers (`lib/ai/providers/`)

| Provider | Models Available | File |
|----------|------------------|------|
| **OpenAI** | GPT-5.2, GPT-5, GPT-4o, o1, o3-mini | `lib/ai/providers/openai.ts` |
| **Google Gemini** | 1.5 Flash, 1.5 Pro, 2.0 Flash Exp | `lib/ai/providers/gemini.ts` |
| **Mistral** | Large, Medium, Small | `lib/ai/providers/mistral.ts` |

#### How to Add a New AI Provider

1. **Create provider file** in `lib/ai/providers/{name}.ts`:

```typescript
import { AIProviderInterface } from '@/lib/ai/types';

export class NewProvider implements AIProviderInterface {
  async streamChatCompletion(messages, model, options) {
    // Implementation
  }

  getRecommendedModel() {
    // Return recommended model
  }
}
```

2. **Register in `lib/ai/registry.ts`**:

```typescript
import { NewProvider } from './providers/new-provider';

registry.register('new-provider', new NewProvider(apiKey));
```

3. **Add environment variable** for API key

#### AI Provider Usage

```typescript
import { ProviderRegistry } from '@/lib/ai/registry';

// Get provider
const provider = registry.getProvider('openai');

// Stream completion
const stream = await provider.streamChatCompletion(
  messages,
  'gpt-4o',
  { temperature: 0.7 }
);
```

### External Data Connectors

#### Supported Connectors (`lib/connectors/`)

| Connector | Auth Type | File |
|-----------|-----------|------|
| **Confluence** | OAuth 2.0 | `lib/connectors/confluence.ts` |
| **Notion** | API Key | `lib/connectors/notion.ts` |
| **SharePoint** | OAuth | `lib/connectors/sharepoint.ts` |
| **Google Drive** | OAuth | `lib/connectors/google-drive.ts` |
| **Slack** | Webhook | `lib/connectors/slack.ts` |
| **Web Scraper** | Basic | `lib/connectors/web.ts` |

#### How to Connect a New Data Provider

1. **Create connector class** extending `BaseConnector`:

```typescript
import { BaseConnector } from '@/lib/connectors/base';

export class NewConnector extends BaseConnector {
  async testConnection() {
    // Validate credentials
  }

  async fetchDocuments() {
    // Fetch documents from source
  }

  async downloadDocument(documentId) {
    // Download document content
  }
}
```

2. **Register in `lib/connectors/factory.ts`**:

```typescript
export class ConnectorFactory {
  static create(type: string, config: ConnectorConfig) {
    switch (type) {
      case 'new-source':
        return new NewConnector(config);
    }
  }
}
```

3. **Create sync job** via API:

```bash
POST /api/data-sources
{
  "name": "My Data Source",
  "type": "confluence",
  "config": { "spaceKey": "TEAM" },
  "credentials": { "accessToken": "...", "baseUrl": "..." }
}
```

#### Data Source Sync Flow

```
Create Data Source → Configure Credentials → Test Connection
→ Create Sync Job → Fetch Documents → Process for RAG → Index in Qdrant
```

---

## Processing Pipelines

### 1. Document Processing Pipeline (RAG)

**Complete Flow:**

```
Upload/Ingest → Text Extraction → Smart Chunking → Embedding Generation → Vector Storage → RAG Package Assignment
```

#### Step 1: Text Extraction (`lib/rag/text-extract.ts`)

| Format | Library | Method |
|--------|---------|--------|
| PDF | `pdf-parse` | Native JS PDF parsing |
| DOCX | `mammoth` | Word document extraction |
| XLSX | `xlsx` | Excel spreadsheet parsing |
| PPTX | `adm-zip` | PowerPoint XML extraction |
| Images/Scanned PDFs | OCR Service | `/api/ocr` endpoint |

```typescript
import { extractText } from '@/lib/rag/text-extract';

const text = await extractText(buffer, 'application/pdf');
```

#### Step 2: Smart Chunking (`lib/rag/smart-chunking.ts`)

```typescript
import { smartChunk } from '@/lib/rag/smart-chunking';

const chunks = await smartChunk(text, {
  maxChunkSize: 1200,
  overlap: 200,
  preserveHeadings: true
});
```

**Chunking Features:**
- Semantic paragraph-aware splitting
- Configurable chunk size and overlap
- Heading and sentence preservation
- Metadata tracking (source, position, etc.)

#### Step 3: Embedding Generation (`lib/rag/embeddings.ts`)

```typescript
import { generateEmbeddings } from '@/lib/rag/embeddings';

const embeddings = await generateEmbeddings(chunks);
// Returns: number[][] - 3072-dimensional vectors
```

**Embedding Details:**
- Model: OpenAI `text-embedding-3-large`
- Dimensions: 3072
- Distance Metric: Cosine similarity

#### Step 4: Vector Storage (`lib/rag/qdrant.ts`)

```typescript
import { upsertPoints } from '@/lib/rag/qdrant';

await upsertPoints(packageId, points);
```

**Qdrant Operations:**
- Create collection per RAG package
- Upsert points with payloads
- Semantic search with filtering
- Scroll API for pagination

### 2. Chat Processing Pipeline

```
User Message → Context Retrieval (RAG) → AI Provider → Stream Response → Display
```

#### Context Retrieval

```typescript
// 1. Search for relevant documents
const results = await searchQdrant(packageId, query, topK: 5);

// 2. Format context
const context = results.map(r => r.payload.content).join('\n');

// 3. Add to messages
const messages = [
  { role: 'system', content: `Context: ${context}` },
  { role: 'user', content: userMessage }
];
```

#### AI Streaming

```typescript
const stream = await provider.streamChatCompletion(
  messages,
  model,
  options
);

// Stream via Server-Sent Events
for await (const chunk of stream) {
  sendEvent(chunk);
}
```

### 3. Data Synchronization Pipeline

```
Webhook/Scheduled Job → Connector → Fetch Documents → Change Detection → Process → RAG Ingest
```

#### Sync Job Types

| Type | Trigger | Description |
|------|---------|-------------|
| Full Sync | Manual | Re-sync all documents |
| Incremental | Scheduled | Sync only changed documents |
| Webhook | Event | Real-time sync on external changes |

#### Change Detection

```typescript
// Checksum-based comparison
const existingChecksum = existingDoc.checksum;
const newChecksum = hash(content);

if (existingChecksum !== newChecksum) {
  // Process updated document
}
```

---

## Key Components

### Component Structure (`components/`)

#### Chat Components

| Component | Purpose | File |
|-----------|---------|------|
| ChatLayout | Main chat interface | `components/chat/chat-layout.tsx` |
| ChatSidebar | Conversation list | `components/chat/chat-sidebar.tsx` |
| ImageMessage | Image display in chat | `components/chat/image-message.tsx` |
| CodeBlock | Code syntax highlighting | `components/chat/code-block.tsx` |

#### Dashboard Components

| Component | Purpose | File |
|-----------|---------|------|
| TeamSettings | Team management | `components/dashboard/team-settings.tsx` |
| APIKeyManager | API key CRUD | `components/dashboard/api-keys/` |
| SessionsManager | Active sessions | `components/dashboard/sessions/` |

#### RAG Components

| Component | Purpose | File |
|-----------|---------|------|
| MindmapViewer | Document relationship graph | `components/rag/mindmap-viewer.tsx` |
| RAGNetworkGraph | Interactive network view | `components/rag/rag-network-graph.tsx` |

#### UI Components (shadcn/ui)

Standardized UI components: Button, Card, Dialog, Input, Select, etc.

---

## API Endpoints

### Authentication (`/api/auth/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/[...nextauth]` | ALL | NextAuth handler |
| `/api/auth/callback/stack` | GET | Stack Auth OAuth callback |
| `/api/auth/register-team` | POST | Register new team |

### Chat (`/api/chat/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/conversations` | GET/POST | List/create conversations |
| `/api/chat/conversations/[id]` | GET/PUT/DELETE | Manage conversation |
| `/api/chat/conversations/[id]/stream` | POST | Stream chat response |
| `/api/chat/conversations/[id]/query` | POST | Query with RAG |
| `/api/chat/documents/search` | POST | Search documents |

### RAG (`/api/rag/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rag/packages` | GET/POST | List/create RAG packages |
| `/api/rag/packages/[id]` | GET/PUT/DELETE | Manage package |
| `/api/rag/packages/[id]/documents` | GET | List documents |
| `/api/rag/packages/[id]/ingest` | POST | Ingest document |
| `/api/rag/query` | POST | Query RAG system |
| `/api/rag/graph/[packageId]` | GET | Get knowledge graph |

### Admin (`/api/admin/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/assign` | POST | Assign global role |
| `/api/admin/teams` | GET | List all teams |
| `/api/admin/rags` | GET | List RAG packages |
| `/api/admin/rags/assign` | POST | Assign RAG to team |
| `/api/admin/billing` | GET | Get billing data |
| `/api/admin/plans` | GET/POST | Manage plans |
| `/api/admin/analytics/teams` | GET | Team analytics |

### Documents (`/api/documents/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents` | GET | List documents |
| `/api/documents/[id]` | GET/PUT/DELETE | Manage document |
| `/api/documents/[id]/assignments` | GET | Get RAG assignments |

### Data Sources (`/api/data-sources/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/data-sources` | GET/POST | List/create sources |
| `/api/data-sources/[id]` | GET/PUT/DELETE | Manage source |
| `/api/data-sources/[id]/sync` | POST | Trigger sync job |

### User (`/api/user/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/preferences` | GET/PUT | User preferences |
| `/api/user/sessions` | GET | Active sessions |
| `/api/user/sessions/[sessionId]` | DELETE | Revoke session |
| `/api/user/roles` | GET | User roles |
| `/api/user/permissions` | GET | User permissions |

---

## Database Schema Overview

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `teams` | Team/workspace data | slug, name, description |
| `team_members` | Team membership | user_id, team_slug, role |
| `rag_packages` | RAG collections | id, name, team_slug, collection_name |
| `rag_documents` | Document metadata | id, package_id, name, status |
| `chat_conversations` | Chat sessions | id, slug, team_slug |
| `role_assignments` | Global roles | user_id, role |
| `plans` | Pricing plans | id, name, limits (JSON) |
| `team_subscriptions` | Subscriptions | team_slug, plan_id, status |
| `data_sources` | External connections | id, team_slug, type, config |
| `sync_jobs` | Sync history | id, data_source_id, status |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `next.config.js` | Next.js config (standalone output, images, headers) |
| `i18n.ts` | Internationalization config (locales: en, de, es) |
| `lib/db.ts` | PostgreSQL connection & schema |
| `lib/redis.ts` | Redis client configuration |
| `lib/stack/stack-config.ts` | Stack Auth configuration |

---

## Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# AI Providers
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...

# Storage
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...

# Vector DB
QDRANT_URL=...
QDRANT_API_KEY=...

# Cache
REDIS_URL=redis://...

# Auth
NEXT_PUBLIC_STACK_API_KEY=...
NEXT_PUBLIC_STACK_PROJECT_ID=...
```

---

## Summary

This document provides a comprehensive overview of the Nexary application architecture. Key takeaways:

1. **Admin Access**: Requires `global-admin` role in `role_assignments` table
2. **AI Providers**: Extensible via registry pattern in `lib/ai/`
3. **Data Connectors**: Extensible via factory pattern in `lib/connectors/`
4. **RAG Pipeline**: Upload → Extract → Chunk → Embed → Store in Qdrant
5. **Auth**: Stack Auth for authentication, PostgreSQL for permissions
6. **i18n**: Full support for English, German, Spanish
