# Nexary System Architecture

## Overview

Nexary is a modern, full-stack AI platform built on Next.js 15, designed to provide enterprise-grade AI chat capabilities with RAG (Retrieval-Augmented Generation), multi-tenant team collaboration, and comprehensive compliance features.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Nexary Platform                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Web UI    │  │  Mobile UI  │  │   CLI/SDK   │                 │
│  │ (Next.js)   │  │  (React     │  │  (Node.js)  │                 │
│  │  + Tailwind │  │   Native)   │  │             │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                │                │                         │
│         └────────────────┴────────────────┘                         │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway Layer                         │   │
│  │  (Next.js API Routes + Middleware + Rate Limiting)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│         ┌────────────────┼────────────────┐                        │
│         ▼                ▼                ▼                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                  │
│  │   Auth     │  │   Chat     │  │    RAG     │                  │
│  │  Service   │  │  Service   │  │  Service   │                  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                  │
│        │                │                │                         │
│        └────────────────┼────────────────┘                        │
│                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Business Logic Layer                     │ │
│  │  (AI Providers • RAG Pipeline • Team Management)             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                         │
│         ┌───────────────┼───────────────┬───────────────┐        │
│         ▼               ▼               ▼               ▼        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │PostgreSQL│  │  Qdrant  │  │  Redis   │  │  MinIO   │       │
│  │ Primary  │  │ Vector   │  │  Cache   │  │ Storage  │       │
│  │   DB     │  │   DB     │  │          │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer

#### Web UI
- **Framework**: Next.js 15 with App Router
- **UI Components**: Radix UI + Tailwind CSS + shadcn/ui
- **State Management**: React Context + Hooks
- **Internationalization**: next-intl (en/de/es)
- **Real-time**: Server-Sent Events (SSE) for streaming

#### Key Features
- Responsive design with mobile-first approach
- Dark mode support
- Accessibility (WCAG 2.1 AA compliant)
- Progressive Web App (PWA) capabilities

### 2. API Gateway Layer

#### API Routes Structure
```
app/api/
├── auth/           # Authentication & authorization
├── chat/           # Chat & conversation management
├── rag/            # RAG & document processing
├── team/           # Team collaboration
├── documents/      # Document hub
├── compliance/     # GDPR/HIPAA endpoints
├── admin/          # Admin operations
└── invitations/    # Team invitations
```

#### Middleware Stack
1. **Authentication**: Stack Auth session validation
2. **Rate Limiting**: Request throttling per user/API key
3. **Request Logging**: Structured logging for monitoring
4. **CORS**: Cross-origin resource sharing
5. **Body Parser**: JSON/multipart parsing

### 3. Business Logic Layer

#### AI Provider System
```typescript
// Registry pattern for multiple AI providers
AIProviderInterface
├── OpenAIProvider
│   ├── Models: GPT-4, GPT-4 Turbo, GPT-3.5
│   └── Features: Text, Vision
├── GeminiProvider
│   ├── Models: Gemini Pro, Gemini Pro Vision
│   └── Features: Multi-modal, Long context
├── MistralProvider
│   ├── Models: Mistral Large, Mistral Medium
│   └── Features: Fast inference
└── AnthropicProvider
    ├── Models: Claude 3 Opus, Claude 3 Sonnet
    └── Features: Constitutional AI
```

#### RAG Pipeline
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Upload  │ -> │ Extract  │ -> │  Chunk   │ -> │ Embed    │
│ Document │    │   Text   │    │  Smart   │    │  Vector  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                   │
                                                   ▼
                                          ┌──────────┐
                                          │  Store   │
                                          │  Qdrant  │
                                          └──────────┘
```

**Processing Steps**:
1. **Upload**: Accept PDF, DOCX, XLSX, PPTX (max 10MB)
2. **Extract**: Parse text using document-specific libraries
3. **Chunk**: Semantic paragraph-aware chunking (max 1000 chars)
4. **Embed**: Generate vector embeddings using AI provider
5. **Store**: Persist in Qdrant with metadata
6. **Retrieve**: Hybrid search (BM25 + vector similarity)

### 4. Data Layer

#### PostgreSQL Database
**Schema**: `projectnexus`

**Key Tables**:
- `teams`, `team_members` - Multi-tenant organization
- `chat_conversations`, `chat_messages` - Chat history
- `rag_packages`, `rag_documents` - Knowledge bases
- `role_permissions`, `api_keys` - Authorization
- `audit_logs` - Compliance tracking
- `consent_records` - GDPR compliance
- `stgb203_immutable_audit_logs` - Legal sector compliance

**Connection Management**:
- Connection pooling via `pg` library
- Automatic schema initialization
- Transaction support for consistency
- Prepared statements for performance

#### Qdrant Vector Database
**Collections**: Named by RAG package ID

**Vector Configuration**:
- Dimensions: Depends on embedding model (768-1536)
- Distance Metric: Cosine similarity
- Indexing: HNSW for fast retrieval

**Search Capabilities**:
- Vector similarity search
- Metadata filtering
- Hybrid search with BM25
- Faceted search

#### Redis Cache
**Use Cases**:
- Session storage
- API key rate limiting
- Query result caching
- Real-time data synchronization

**Data Structures**:
- String: Simple key-value
- Hash: User sessions
- Sorted Set: Rate limiting counters
- Pub/Sub: Real-time updates

#### MinIO Object Storage
**Buckets**:
- `documents` - RAG document storage
- `uploads` - Temporary upload storage
- `exports` - GDPR data exports

**Features**:
- Presigned URLs for direct upload
- Fallback to in-memory if unavailable
- Lifecycle policies for cleanup
- Encryption at rest

### 5. Authentication & Authorization

#### Stack Auth Integration
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │ <-> │  Stack Auth  │ <-> │   Nexary     │
│   Browser    │     │    Service   │     │   Backend    │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Session     │
                    │  Validation  │
                    └──────────────┘
```

**Flow**:
1. User initiates login via Stack Auth
2. Stack Auth handles authentication
3. Callback redirects with session token
4. Nexary validates token with Stack Server
5. Session stored in Redis + cookie

#### Permission Model
```
Global Roles:
├── admin         # Full system access
└── user          # Standard user access

Team Roles:
├── team-owner    # Full team management
├── team-leader   # Team administration
└── member        # Basic team access

Permissions:
├── $update_team  # Team management
├── rag:query     # Search RAG packages
├── rag:ingest    # Add documents
├── rag:update    # Edit packages
└── rag:delete    # Delete content
```

## Data Flow

### Chat Flow
```
User Input
    │
    ▼
Create Message (DB)
    │
    ▼
Load Context (DB)
    │
    ├─────────────┐
    │             │
    ▼             ▼
RAG Search   Build Prompt
    │             │
    │             ▼
    │      Call AI Provider
    │             │
    │             ▼
    └──────────► Stream Response
                  │
                  ▼
            Save Message (DB)
                  │
                  ▼
            Update UI (SSE)
```

### RAG Ingestion Flow
```
Upload File
    │
    ▼
Validate (size, type)
    │
    ▼
Store in MinIO
    │
    ▼
Extract Text
    │
    ├──── PDF: pdf-parse
    ├──── DOCX: mammoth
    ├──── XLSX: xlsx
    └──── PPTX: adm-zip
    │
    ▼
Smart Chunking
    │
    ▼
Generate Embeddings
    │
    ▼
Store in Qdrant
    │
    ▼
Update Metadata (DB)
    │
    ▼
Return Result
```

## Security Architecture

### Authentication Security
- JWT-based session tokens
- Secure cookie flags (HttpOnly, Secure, SameSite)
- CSRF protection via token validation
- Session expiration with refresh tokens

### Data Security
- Encryption at rest (MinIO, PostgreSQL)
- Encryption in transit (TLS 1.3)
- API key rotation support
- PII data masking in logs

### Network Security
- Content Security Policy (CSP)
- CORS configuration
- Rate limiting per user
- DDoS protection (via infrastructure)

### Compliance Security
- GDPR consent tracking
- HIPAA PHI access logging
- Immutable audit logs (§203 StGB)
- Data residency controls

## Scalability Architecture

### Horizontal Scaling
```
                    ┌─────────────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ Next.js │         │ Next.js │         │ Next.js │
    │ Instance│         │ Instance│         │ Instance│
    └────┬────┘         └────┬────┘         └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │PostgreSQL│       │PostgreSQL│       │PostgreSQL│
    │ Primary  │◄─────┤ Replica  │◄─────┤ Replica  │
    └──────────┘       └──────────┘       └──────────┘
```

### Database Scaling
- **Read Replicas**: Distribute read queries
- **Connection Pooling**: Efficient connection reuse
- **Indexing Strategy**: Optimized query performance
- **Partitioning**: Time-based audit log partitioning

### Caching Strategy
- **Response Caching**: API endpoint caching
- **Query Caching**: Database query results
- **Session Caching**: Redis-backed sessions
- **CDN**: Static asset delivery

## Monitoring & Observability

### Logging
- **Structured Logging**: JSON-formatted logs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Aggregation**: Centralized log collection
- **Sensitive Data Redaction**: Auto-mask PII

### Metrics
- **Application Metrics**: Request latency, error rates
- **Database Metrics**: Query performance, pool usage
- **Cache Metrics**: Hit rates, memory usage
- **Business Metrics**: User activity, feature usage

### Tracing
- **Distributed Tracing**: Request flow across services
- **Error Tracking**: Exception aggregation
- **Performance Monitoring**: Transaction traces

## Deployment Architecture

### Container Strategy
```dockerfile
# Multi-stage build
Stage 1: Dependencies
Stage 2: Build
Stage 3: Production Runtime
```

### Orchestration
- **Kubernetes**: Container orchestration
- **Service Mesh**: Istio for service communication
- **Ingress**: NGINX Ingress Controller
- **Autoscaling**: HPA based on CPU/memory

### Infrastructure
- **Cloud Provider**: AWS/GCP/Azure
- **Regions**: Multi-region deployment
- **CDN**: CloudFront/Cloudflare
- **DNS**: Route 53/Cloud DNS

## Disaster Recovery

### Backup Strategy
- **Database Backups**: Daily full + hourly incremental
- **Backups Retention**: 30 days
- **Backup Location**: Cross-region
- **Restore Testing**: Weekly validation

### High Availability
- **Multi-AZ Deployment**: Zone redundancy
- **Failover**: Automatic failover for critical services
- **Health Checks**: Liveness/readiness probes
- **Circuit Breakers**: Fault isolation

### Business Continuity
- **RPO**: 1 hour (max data loss)
- **RTO**: 4 hours (max downtime)
- **Incident Response**: 24/7 on-call rotation
- **Communication**: Status page updates

## Future Considerations

### Planned Enhancements
1. **GraphQL API**: Alternative to REST endpoints
2. **WebSocket Support**: Real-time collaboration
3. **Edge Computing**: Cloudflare Workers for global latency
4. **AI Model Fine-tuning**: Custom model training
5. **Multi-modal RAG**: Image/video support

### Technical Debt
1. **API Versioning**: Implement proper versioning strategy
2. **Event Sourcing**: For audit log efficiency
3. **Read Model**: CQRS for complex queries
4. **Message Queue**: Replace synchronous processing
5. **Feature Flags**: Gradual rollout capability
