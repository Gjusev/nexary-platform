# Multi-Source RAG System - Conectores y Sincronización

Sistema RAG multi-fuente para Nexary AI que permite crear contenedores RAG desde múltiples fuentes de datos externas: SaaS Platforms, Web Content y Bases de Datos.

## 📋 Tabla de Contenidos

- [Arquitectura General](#arquitectura-general)
- [Modelo Multi-Tenencia](#modelo-multi-tenencia)
- [Conectores Disponibles](#conectores-disponibles)
- [Guía de Configuración](#guía-de-configuración)
- [Sistema de Sincronización](#sistema-de-sincronización)
- [ACLs y Permisos](#acls-y-permisos)
- [API Endpoints](#api-endpoints)
- [Ejemplos de Uso](#ejemplos-de-uso)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        MULTIPLE TEAMS                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Team A     │  │   Team B     │  │   Team C     │       │
│  │  (Acme Inc)  │  │  (StartupCo) │  │  (Enterprise)│       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
└─────────┼──────────────────┼──────────────────┼───────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA SOURCES (per Team)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Confluence   │  │    Notion    │  │  Web Scraper │       │
│  │  (Team A)     │  │  (Team B)     │  │  (Team A)     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐       │
│  │ SharePoint   │  │ Google Drive │  │   Database   │       │
│  │  (Team A)     │  │  (Team C)     │  │  (Team B)     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONNECTORS LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Confluence   │  │    Notion    │  │  Web Scraper │       │
│  │  Connector    │  │  Connector    │  │  Connector    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐       │
│  │ SharePoint   │  │ Google Drive │  │   Database   │       │
│  │  Connector    │  │  Connector    │  │  Connector    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SYNC SYSTEM (per Team)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Scheduler  │  │  Processor    │  │  Webhooks     │       │
│  │  (Cron Jobs)  │  │  (Sync Jobs)  │  │  (Real-time)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              DOCUMENTS STORE (PostgreSQL)                        │
│  • data_sources              • external_documents               │
│  • sync_jobs                 • external_document_acls          │
│  • master_documents          • document_rag_assignments        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RAG PROCESSING (per Team)                        │
│  • ACL Extraction           • Chunking                            │
│  • Metadata Enhancement   • Embedding                           │
│  • Permission Mapping     • Qdrant Upsert                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VECTOR STORE (Qdrant)                           │
│  • Collections per RAG Package                                    │
│  • ACL-aware Payloads                                              │
│  • Source Metadata                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modelo Multi-Tenencia

Cada **team** es completamente independiente. Los data sources, conectores y documentos están aislados por team:

### Aislamiento de Datos

```sql
-- Cada data source pertenece a un team específico
CREATE TABLE data_sources (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,        -- ← Identificador del team
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  config JSONB NOT NULL,           -- Credenciales encriptadas por team
  ...
);

-- Los documentos externos también están aislados
CREATE TABLE external_documents (
  id UUID PRIMARY KEY,
  data_source_id UUID REFERENCES data_sources(id),
  team_slug TEXT NOT NULL,         -- ← Heredado del data source
  ...
);

-- Los RAG packages también son por team
CREATE TABLE rag_packages (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,         -- ← Identificador del team
  ...
);
```

### Configuración Independiente

**Ejemplo: Team A vs Team B**

```typescript
// Team A (Acme Inc) - Confluence
const teamA_Confluence = {
  team_slug: 'acme-inc',
  source_type: 'confluence',
  config: {
    baseUrl: 'https://acme.atlassian.net',
    credentials: { /* encriptado */ }
  }
};

// Team B (StartupCo) - Notion
const teamB_Notion = {
  team_slug: 'startupco',
  source_type: 'notion',
  config: {
    credentials: { /* encriptado */ }
  }
};

// Cada team tiene sus propias credenciales y documentos
// ¡No hay cruce de datos entre teams!
```

---

## Conectores Disponibles

### 1. Confluence Connector

**Fuente:** Atlassian Confluence (Wiki corporativo)

**Autenticación:** OAuth 2.0

**Características:**
- ✅ Extracción de páginas y espacios
- ✅ HTML a texto plano
- ✅ Permisos nativos (view, edit, admin)
- ✅ Soporte de attachments
- ✅ Sincronización incremental
- ✅ Metadata: space_key, page_id, version, ancestors

**Rate Limit:** 1000 peticiones/hora

```typescript
// Configuración ejemplo
{
  team_slug: 'acme-inc',
  name: 'Confluence Wiki',
  source_type: 'confluence',
  config: {
    baseUrl: 'https://acme.atlassian.net',
    credentials: {
      type: 'oauth',
      accessToken: '...',
      refreshToken: '...'
    }
  },
  sync_frequency: 'daily'
}
```

---

### 2. Notion Connector

**Fuente:** Notion (Workspace de documentación)

**Autenticación:** API Key (Integration Token)

**Características:**
- ✅ Páginas y bases de datos
- ✅ Bloques a Markdown
- ✅ Última edición tracking
- ✅ Páginas anidadas
- ✅ Rate limiting: 3 requests/segundo

**Rate Limit:** 3 requests/segundo (Tier 1)

```typescript
// Configuración ejemplo
{
  team_slug: 'startupco',
  name: 'Notion Docs',
  source_type: 'notion',
  config: {
    credentials: {
      type: 'api_key',
      apiKey: 'secret_...'
    }
  },
  sync_frequency: 'hourly'
}
```

---

### 3. Web Scraper Connector

**Fuente:** Web pública

**Autenticación:** Ninguna

**Características:**
- ✅ Múltiples URLs
- ✅ Configuración de profundidad
- ✅ Filtrado de dominios
- ✅ Respeto a robots.txt
- ✅ Metadata extraction

**Rate Limit:** 1 request/segundo (polite crawling)

```typescript
// Configuración ejemplo
{
  team_slug: 'acme-inc',
  name: 'Competitor Sites',
  source_type: 'web',
  config: {
    urls: ['https://competitor.com/docs'],
    maxDepth: 2,
    allowedDomains: ['competitor.com'],
    respectRobotsTxt: true
  },
  sync_frequency: 'weekly'
}
```

---

### 4. SharePoint Connector (Pendiente)

**Fuente:** Microsoft SharePoint

**Autenticación:** OAuth 2.0

**Características:**
- Document libraries
- File content extraction
- Folder hierarchy
- Permission inheritance

---

### 5. Google Drive Connector (Pendiente)

**Fuente:** Google Drive

**Autenticación:** OAuth 2.0

**Características:**
- Files and folders
- Multiple formats
- Shared drives
- Sharing permissions

---

### 6. Slack Connector (Pendiente)

**Fuente:** Slack

**Autenticación:** OAuth 2.0

**Características:**
- Channel messages
- Thread support
- User context
- File attachments

---

## Guía de Configuración

### Paso 1: Variables de Entorno

```bash
# Seguridad
CREDENTIALS_ENCRYPTION_KEY=your-32-byte-hex-key

# Confluence OAuth
CONFLUENCE_CLIENT_ID=
CONFLUENCE_CLIENT_SECRET=
CONFLUENCE_REDIRECT_URI=

# Notion (API key)
NOTION_API_KEY=secret_*

# SharePoint OAuth
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_TENANT_ID=

# Google Drive OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Slack OAuth
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

### Paso 2: Generar Clave de Encriptación

```bash
# Generar una clave de 32 bytes (64 caracteres hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 3: Crear Data Source

```typescript
// POST /api/data-sources
{
  "team_slug": "acme-inc",
  "name": "Confluence Knowledge Base",
  "source_type": "confluence",
  "config": {
    "baseUrl": "https://acme.atlassian.net",
    "credentials": {
      "type": "oauth",
      "accessToken": "...",
      "refreshToken": "..."
    }
  },
  "sync_frequency": "daily",
  "sync_enabled": true,
  "auto_rag_package_ids": ["rag-package-uuid"]
}
```

### Paso 4: Sincronizar Documentos

```typescript
// POST /api/data-sources/{id}/sync
{
  "job_type": "incremental", // o "full"
  "wait": false // true para procesamiento síncrono
}
```

---

## Sistema de Sincronización

### Frecuencias Disponibles

| Frecuencia | Descripción | Cron Expression |
|-----------|-------------|-----------------|
| `hourly` | Cada hora | `0 * * * *` |
| `every_6_hours` | Cada 6 horas | `0 */6 * * *` |
| `every_12_hours` | Cada 12 horas | `0 */12 * * *` |
| `daily` | Diariamente (2 AM) | `0 2 * * *` |
| `weekly` | Semanal (domingo 2 AM) | `0 2 * * 0` |
| `monthly` | Mensual (1ero, 2 AM) | `0 2 1 * *` |
| `manual` | Solo manual | - |

### Tipos de Sync Jobs

1. **Full Sync**: Sincroniza todos los documentos desde cero
2. **Incremental Sync**: Solo sincroniza documentos modificados desde `last_sync_at`
3. **Webhook Sync**: Trigger por eventos en tiempo real
4. **Manual Sync**: Trigger manual por usuario o admin

### Proceso de Sincronización

```
┌─────────────────────────────────────────────────────────────┐
│                    1. SCHEDULE TRIGGER                        │
│  • Cron job ejecuta según frecuencia                           │
│  • Crea sync_job en estado 'pending'                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    2. SYNC PROCESSOR                          │
│  • Conector valida conexión                                   │
│  • Obtiene documentos desde fuente externa                     │
│  • Detecta cambios (checksums, timestamps)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    3. CHANGE DETECTION                        │
│  • Compara checksums (SHA-256)                               │
│  • Identifica: created, updated, deleted                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    4. DOCUMENT PROCESSING                     │
│  • Crea/actualiza external_document                          │
│  • Crea/actualiza master_document                            │
│  • Asigna a RAG packages (auto_rag_package_ids)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    5. RAG PROCESSING                          │
│  • Extrae ACLs y permisos                                     │
│  • Chunking del contenido                                     │
│  • Genera embeddings                                         │
│  • Guarda en Qdrant con metadata extendida                   │
└─────────────────────────────────────────────────────────────┘
```

---

## ACLs y Permisos

### Modelo de Permisos

Cada documento tiene permisos específicos que se respetan durante las búsquedas:

```typescript
interface AclInfo {
  // Banderas
  public?: boolean;  // Documento público (acceso total)

  // Listas de usuarios con acceso
  read_users?: string[];      // ["user-1", "user-2"]
  write_users?: string[];     // ["user-1"]
  admin_users?: string[];      // ["admin-1"]

  // Listas de teams con acceso
  read_teams?: string[];      // ["team-a", "team-b"]
  write_teams?: string[];     // ["team-a"]
  admin_teams?: string[];      // ["admin-team"]

  // Permisos nativos de la fuente
  source_permissions?: Array<{
    principal_id: string;
    principal_type: 'user' | 'group';
    permission_level: 'read' | 'write' | 'admin' | 'owner';
  }>;

  // Mapeo a usuarios/teams internos
  mapped_acls?: Array<{
    internal_user_id?: string;
    internal_team_slug?: string;
    permission_level: 'read' | 'write' | 'admin';
  }>;
}
```

### Extracción de ACLs por Fuente

#### Confluence
```typescript
// Confluence permissions: view, edit, admin, delete
{
  principalId: 'account-id',
  permissionLevel: 'read' | 'write' | 'admin'
}
```

#### Notion
```typescript
// Notion: Workspace-level permissions
// Se mapean a teams internos
{
  permissionLevel: 'read' // Todos los miembros del team
}
```

#### Web Scraper
```typescript
// Web: Todos los documentos son públicos
{
  public: true
}
```

### Validación de Accesso

```typescript
// Durante una búsqueda RAG, se filtran resultados por permisos
function validateAccess(
  payload: QdrantPayload,
  userId?: string,
  teamSlugs?: string[]
): boolean {
  const acl = payload.acl;

  // Documentos públicos son accesibles
  if (acl?.public) return true;

  // Verificar acceso de usuario
  if (userId && acl?.read_users?.includes(userId)) return true;

  // Verificar acceso de team
  if (teamSlugs && teamSlugs.some(t => acl?.read_teams?.includes(t))) return true;

  return false; // Sin acceso
}
```

---

## API Endpoints

### Data Sources

#### Listar Data Sources
```http
GET /api/data-sources?team_slug={team_slug}
```

#### Crear Data Source
```http
POST /api/data-sources
Content-Type: application/json

{
  "team_slug": "acme-inc",
  "name": "Confluence Wiki",
  "source_type": "confluence",
  "config": {
    "baseUrl": "https://acme.atlassian.net",
    "credentials": { ... }
  },
  "sync_frequency": "daily",
  "sync_enabled": true,
  "auto_rag_package_ids": ["rag-uuid"]
}
```

#### Obtener Data Source
```http
GET /api/data-sources/{id}
```

#### Actualizar Data Source
```http
PUT /api/data-sources/{id}
Content-Type: application/json

{
  "name": "Nuevo Nombre",
  "sync_frequency": "hourly"
}
```

#### Eliminar Data Source
```http
DELETE /api/data-sources/{id}
```

---

### Sync Jobs

#### Trigger Sync
```http
POST /api/data-sources/{id}/sync
Content-Type: application/json

{
  "job_type": "incremental",
  "user_id": "user-123",
  "wait": false
}
```

#### Listar Sync Jobs
```http
GET /api/data-sources/{id}/sync/jobs?limit=20&offset=0&status=completed
```

#### Obtener Sync Job
```http
GET /api/sync-jobs/{id}
```

#### Cancelar Sync Job
```http
DELETE /api/sync-jobs/{id}
```

---

### Webhooks

#### Recibir Webhook
```http
POST /api/webhooks/{sourceType}/{dataSourceId}
Content-Type: application/json
X-Signature: {signature}

{
  "eventType": "page_updated",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": { ... }
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Configurar Confluence para Team A

```typescript
// 1. Crear data source
const confluenceSource = await fetch('/api/data-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    team_slug: 'acme-inc',
    name: 'Acme Confluence',
    source_type: 'confluence',
    config: {
      baseUrl: 'https://acme.atlassian.net',
      credentials: {
        type: 'oauth',
        accessToken: 'token-obtenido-de-oauth',
        refreshToken: 'refresh-token'
      }
    },
    sync_frequency: 'daily',
    sync_enabled: true,
    auto_rag_package_ids: ['acme-knowledge-rag']
    }
  })
});

const dataSourceId = await confluenceSource.json().id;

// 2. Trigger sync inicial
await fetch(`/api/data-sources/${dataSourceId}/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    job_type: 'full',
    user_id: 'admin@acme.com'
  })
});

// 3. Verificar progreso
const jobs = await fetch(`/api/data-sources/${dataSourceId}/sync/jobs?status=running`);
```

---

### Ejemplo 2: Configurar Notion para Team B

```typescript
const notionSource = await fetch('/api/data-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    team_slug: 'startupco',
    name: 'StartupCo Notion',
    source_type: 'notion',
    config: {
      credentials: {
        type: 'api_key',
        apiKey: 'secret_...'
      }
    },
    sync_frequency: 'hourly',
    sync_enabled: true
  })
});
```

---

### Ejemplo 3: Web Scraper con Control de Profundidad

```typescript
const webSource = await fetch('/api/data-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    team_slug: 'acme-inc',
    name: 'Competitor Documentation',
    source_type: 'web',
    config: {
      urls: ['https://competitor.com/docs'],
      maxDepth: 2,
      allowedDomains: ['competitor.com'],
      followLinks: true,
      respectRobotsTxt: true,
      userAgent: 'AcmeBot/1.0'
    },
    sync_frequency: 'weekly',
    sync_enabled: true
  })
});
```

---

## Flujo Completo de Implementación

### Para un Nuevo Team

```typescript
// 1. Crear el team (sistema existente)
await createTeam({
  slug: 'new-team',
  name: 'New Team Inc'
});

// 2. Crear RAG package para el team
const ragPackage = await createRagPackage({
  team_slug: 'new-team',
  name: 'Company Knowledge',
  collection_name: 'rag_new-team_company'
});

// 3. Configurar Confluence para el team
const confluence = await createDataSource({
  team_slug: 'new-team',
  name: 'Company Wiki',
  source_type: 'confluence',
  config: { ... },
  auto_rag_package_ids: [ragPackage.id]
});

// 4. Sincronizar documentos
await triggerSync(confluence.id, 'full');

// 5. Los documentos ahora están disponibles en el RAG del team
const results = await searchRag({
  team_slug: 'new-team',
  rag_package_id: ragPackage.id,
  query: '¿Cuál es la política de vacaciones?'
});
```

---

## Seguridad y Aislamiento

### Encriptación de Credenciales

Todas las credenciales se almacenan encriptadas usando AES-256-GCM:

```typescript
// Al crear un data source
const encrypted = await encryptCredentials({
  type: 'oauth',
  accessToken: 'secret-token',
  refreshToken: 'refresh-secret'
});

// Se guarda en base de datos
config: {
  ...config,
  credentials: encrypted // Encriptado
}
```

### Aislación por Team

```typescript
// Cada query filtra por team_slug automáticamente
const results = await pool.query(`
  SELECT * FROM projectnexus.data_sources
  WHERE team_slug = $1  -- ← Filtro automático
`, [user.team_slug]);
```

---

## Estructura de Archivos

```
lib/
├── connectors/
│   ├── base-connector.ts          # Interfaz abstracta
│   ├── connector-factory.ts       # Factory y registro
│   ├── confluence-connector.ts    # Confluence implementation
│   ├── notion-connector.ts        # Notion implementation
│   ├── web-connector.ts           # Web Scraper implementation
│   ├── sharepoint-connector.ts    # SharePoint (pending)
│   ├── google-drive-connector.ts  # Google Drive (pending)
│   ├── slack-connector.ts         # Slack (pending)
│   └── database-connector.ts      # Database (pending)
│
├── sync/
│   ├── scheduler.ts               # Job scheduler (cron)
│   ├── sync-processor.ts          # Sync processor
│   ├── change-detection.ts        # Change detection
│   └── webhook-handler.ts         # Webhook handlers
│
├── rag/
│   ├── qdrant-payload-types.ts    # Enhanced payloads
│   └── document-processor-extended.ts  # RAG with ACLs
│
└── crypto-utils.ts               # Encriptación de credenciales

app/api/
├── data-sources/
│   ├── route.ts                   # CRUD data sources
│   ├── [id]/route.ts             # GET/PUT/DELETE individual
│   └── [id]/sync/route.ts        # Trigger sync
├── sync-jobs/
│   └── [id]/route.ts              # Job details and cancel
└── webhooks/
    └── [sourceType]/[dataSourceId]/route.ts  # Webhook receiver

migrations/
├── 014_data_sources.sql          # Tabla de data sources
├── 015_external_documents.sql    # Documentos externos
├── 016_sync_jobs.sql             # Jobs de sincronización
├── 017_external_document_acls.sql # ACLs de documentos
└── 018_master_documents_integration.sql # Integración con master docs
```

---

## Próximos Pasos

1. **Implementar conectores adicionales:** SharePoint, Google Drive, Slack
2. **UI Components:** Crear interfaz para configurar data sources
3. **Testing:** Tests de integración para cada conector
4. **Monitoring:** Dashboards para monitorear sync jobs
5. **OAuth Flow:** Implementar flujo completo de OAuth para Confluence, SharePoint, Google Drive, Slack

---

## Troubleshooting

### Error: "Data source not found"
- Verifica que el `team_slug` sea correcto
- Confirma que el data source esté archivado

### Error: "Failed to authenticate"
- Las credenciales son inválidas o expiraron
- Para OAuth: trigger `refreshCredentials()`

### Error: "Rate limit reached"
- El conector ha excedido su límite
- El sistema espera automáticamente y reintenta

### Error: "Connection validation failed"
- Verifica `baseUrl` y credenciales
- Para Confluence: verifica que la URL sea accesible

---

## Soporte

Para más información, consulta:
- [Base Connector Interface](../../lib/connectors/base-connector.ts)
- [Connector Factory](../../lib/connectors/connector-factory.ts)
- [Sync Scheduler](../../lib/sync/scheduler.ts)
- [API Endpoints](../../app/api/data-sources/)
