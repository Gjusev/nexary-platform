# RAG Platform Roadmap - Competing with Kamium/Logicc

## Executive Summary

Nexary ya tiene una arquitectura RAG **excepcional** y competitiva. Los gaps principales son en **UX y features de producto** más que en infraestructura técnica. Este roadmap prioriza features que maximicen el diferencial competitivo con BM25 + Enterprise Compliance.

---

## Phase 1: Critical UX Gaps (Weeks 1-3)

### 1.1 Advanced Search UI with Filters & Facets

**Goal**: Search experience similar to Kamium/Logicc con filtering avanzado

**Implementation**:

```typescript
// components/rag/advanced-search-bar.tsx
interface AdvancedSearchFilters {
  dateRange: { from: Date; to: Date };
  documentTypes: ('pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md')[];
  tags: string[];
  author: string;
  packages: string[];
  minScore: number; // 0-1
}
```

**Components to create**:
- `components/rag/advanced-search-bar.tsx` - Search bar with filter toggle
- `components/rag/search-filters-panel.tsx` - Collapsible filters panel
- `components/rag/search-facets.tsx` - Facets sidebar (count aggregation)
- `components/rag/search-results-list.tsx` - Results with metadata display

**Endpoint enhancements**:
```typescript
// app/api/rag/search/advanced/route.ts (enhance existing)
interface SearchOptions {
  // ... existing
  filters: {
    dateRange?: { gte: Date; lte: Date };
    documentTypes?: string[];
    tags?: string[];
    packages?: string[];
    minScore?: number;
  };
  facets?: string[]; // Return facet counts
}
```

**Priority**: **HIGH** - This is a key differentiator vs competitors

---

### 1.2 Enhanced Citations with Page Numbers

**Goal**: Professional citations como Kamium para lawyers/healthcare (§203 StGB)

**Implementation**:

```typescript
// lib/rag/citations.ts
interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  page?: number;
  paragraph?: number;
  lineRange?: { from: number; to: number };
  text: string;
  score: number;
}
```

**Components to create**:
- `components/rag/citation-chip.tsx` - Clickable citation in chat response
- `components/rag/citation-preview.tsx` - Preview panel with context
- `components/rag/citation-highlight.tsx` - Highlight in document viewer

**Document processing enhancement**:
```typescript
// lib/rag/pdf-processor.ts
async function extractTextWithPageNumbers(pdfBuffer: Buffer) {
  const pdf = await pdfjs.getDocument(pdfBuffer).promise;
  const pages: Record<number, string> = {};

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    pages[i] = text.items.map(item => item.str).join(' ');
  }

  return pages;
}
```

**Priority**: **HIGH** - Critical for §203 StGB compliance in legal/medical

---

### 1.3 Usage Analytics Dashboard

**Goal**: Insights sobre uso de RAG como Kamium/Logicc para valor añadido

**Implementation**:

```typescript
// app/(authenticated)/dashboard/analytics/rag/page.tsx
interface RAGAnalytics {
  queriesOverTime: { date: Date; count: number }[];
  topQueries: { query: string; count: number; avgScore: number }[];
  topDocuments: { documentId: string; filename: string; hitCount: number }[];
  searchMethods: { method: 'hybrid' | 'semantic' | 'lexical'; count: number; percentage: number }[];
  avgResponseTime: number;
  cacheHitRate: number;
}
```

**API endpoint**:
```typescript
// app/api/admin/rag/analytics/route.ts
export async function GET(request: NextRequest) {
  const teamSlug = await getTeamSlug();
  const { from, to, granularity } = parseQuery(request);

  // Query logs from PostgreSQL
  const stats = await query<RAGAnalytics>(`
    WITH query_stats AS (
      SELECT
        DATE_TRUNC($1, created_at) as date,
        COUNT(*) as count
      FROM rag_query_logs
      WHERE team_slug = $2
        AND created_at >= $3
        AND created_at <= $4
      GROUP BY date
    ),
    top_queries AS (
      SELECT
        query_text,
        COUNT(*) as hit_count,
        AVG(score) as avg_score
      FROM rag_query_logs
      WHERE team_slug = $2
      GROUP BY query_text
      ORDER BY hit_count DESC
      LIMIT 10
    ),
    top_docs AS (
      SELECT
        d.id,
        d.filename,
        COUNT(l.id) as hit_count
      FROM rag_query_logs l
      JOIN rag_chunks c ON l.chunk_id = c.id
      JOIN rag_documents d ON c.document_id = d.id
      WHERE l.team_slug = $2
      GROUP BY d.id, d.filename
      ORDER BY hit_count DESC
      LIMIT 10
    )
    SELECT * FROM query_stats, top_queries, top_docs
  `, [granularity, teamSlug, from, to]);

  return NextResponse.json({ data: stats });
}
```

**Database schema**:
```sql
CREATE TABLE rag_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  query_text TEXT NOT NULL,
  search_method VARCHAR(50) NOT NULL, -- 'hybrid', 'semantic', 'lexical'
  rerank_method VARCHAR(50), -- 'cohere', 'cross-encoder', 'ensemble', 'mmr', 'none'
  results_count INTEGER,
  avg_score FLOAT,
  response_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rag_query_logs_team_date ON rag_query_logs(team_slug, created_at DESC);
CREATE INDEX idx_rag_query_logs_user ON rag_query_logs(user_id, created_at DESC);
```

**Priority**: **HIGH** - Adds business value and insights for customers

---

### 1.4 Entity Extraction & Knowledge Graph Enhancement

**Goal**: Knowledge graph más rico con entidades y relaciones como Kamium

**Implementation**:

```typescript
// lib/rag/entity-extraction.ts
async function extractEntities(text: string) {
  // Option 1: Use OpenAI for entity extraction
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `Extract entities from the text. Return JSON with:
      - PERSON (people names)
      - ORG (organizations)
      - LOCATION (locations)
      - DATE (dates)
      - PRODUCT (products)
      - CONCEPT (concepts)

      Return format:
      {
        "entities": [
          { "text": "string", "type": "PERSON|ORG|LOCATION|DATE|PRODUCT|CONCEPT", "start": 0, "end": 10 }
        ],
        "relations": [
          { "source": "string", "target": "string", "type": "WORKS_FOR|LOCATED_IN|RELATED_TO", "confidence": 0.9 }
        ]
      }`
    }, {
      role: 'user',
      content: text
    }],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Enhanced graph visualization**:
```typescript
// components/rag/enhanced-knowledge-graph.tsx
interface KnowledgeGraphNode {
  id: string;
  type: 'chunk' | 'document' | 'entity';
  label: string;
  entityData?: {
    entityType: 'PERSON' | 'ORG' | 'LOCATION' | 'DATE' | 'PRODUCT' | 'CONCEPT';
    frequency: number;
  };
}

interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'similarity' | 'entity-relation';
  weight: number;
  relationType?: string; // For entity relations
}
```

**Priority**: **MEDIUM** - Nice-to-have, adds differentiation

---

## Phase 2: Enterprise Integration Features (Weeks 4-6)

### 2.1 Microsoft SharePoint Connector

**Goal**: Competir con Kamium en integraciones enterprise

**Implementation**:

```typescript
// lib/connectors/sharepoint-connector.ts
class SharePointConnector extends BaseConnector {
  async authenticate(credentials: SharePointCredentials) {
    // OAuth 2.0 with Microsoft Graph API
    const token = await this.acquireToken(credentials);
    return { accessToken: token };
  }

  async listDocuments(siteId: string, libraryName: string) {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${libraryName}/root/children`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return response.data.value;
  }

  async downloadDocument(driveId: string, itemId: string) {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
      { responseType: 'arraybuffer', headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return Buffer.from(response.data);
  }

  async watchChanges(driveId: string) {
    // Use Microsoft Graph change notifications with webhooks
    const subscription = await axios.post(
      `https://graph.microsoft.com/v1.0/subscriptions`,
      {
        changeType: 'created,updated,deleted',
        notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/sharepoint/webhook`,
        resource: `/drives/${driveId}/root`,
        expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString()
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return subscription.data;
  }
}
```

**Database schema**:
```sql
CREATE TABLE sharepoint_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  library_id VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  subscription_id VARCHAR(255),
  last_sync_at TIMESTAMP,
  sync_frequency VARCHAR(50) DEFAULT 'hourly',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_slug, tenant_id, site_id, library_id)
);
```

**Priority**: **HIGH** - Critical for enterprise customers (Microsoft 365 is standard)

---

### 2.2 Slack & Teams Integration

**Goal**: Chat experience integrado como Kamium para workflow

**Implementation**:

```typescript
// app/api/integrations/slack/webhook/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type === 'event_callback' && body.event.type === 'message') {
    const { text, user, channel, team } = body.event;

    // Skip bot messages
    if (bot_id) return NextResponse.json({ ok: true });

    // Query RAG system
    const results = await hybridSearch(
      `rag-package-${team}`,
      text,
      {
        method: 'hybrid',
        limit: 5,
        userId: user
      }
    );

    // Post response to Slack
    await axios.post(
      `https://slack.com/api/chat.postMessage`,
      {
        channel,
        text: results.answer,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: results.answer }
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Sources:*' }
          },
          ...results.sources.map(source => ({
            type: 'section',
            text: { type: 'mrkdwn', text: `• ${source.filename}` }
          }))
        ]
      },
      { headers: { Authorization: `Bearer ${slackToken}` } }
    );

    return NextResponse.json({ ok: true });
  }
}
```

**Priority**: **MEDIUM** - Nice-to-have for productivity

---

### 2.3 Direct Database Connector (PostgreSQL/MySQL)

**Goal**: Live query de databases como Kamium para data insights

**Implementation**:

```typescript
// lib/connectors/database-connector.ts
class DatabaseConnector extends BaseConnector {
  async testConnection(config: DatabaseConfig) {
    if (config.type === 'postgresql') {
      const client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password
      });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
    }
  }

  async describeTable(config: DatabaseConfig, tableName: string) {
    const client = await this.getClient(config);
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
    `, [tableName]);
    return result.rows;
  }

  async queryDatabase(config: DatabaseConfig, query: string, params: any[]) {
    const client = await this.getClient(config);
    const result = await client.query(query, params);
    return result.rows;
  }

  async ingestDatabase(config: DatabaseConfig, options: DatabaseIngestOptions) {
    // Convert table rows to text chunks
    // Generate embeddings
    // Store in Qdrant with metadata (table_name, primary_key, etc.)
  }
}
```

**Priority**: **MEDIUM** - Advanced feature for data-driven organizations

---

## Phase 3: Advanced RAG Features (Weeks 7-9)

### 3.1 Multimodal RAG with GPT-4 Vision

**Goal**: Soporte para imágenes/diagramas en documentos (competir con Kamium)

**Implementation**:

```typescript
// lib/rag/multimodal-processor.ts
async function processImagesInPDF(pdfBuffer: Buffer) {
  const pdf = await pdfjs.getDocument(pdfBuffer).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const ops = await page.getOperatorList();

    // Extract images from page
    const images = ops.fnArray
      .filter((fn, index) => fn === pdfjs.OPS.paintImageXObject)
      .map((fn, index) => ops.argsArray[index][0]);

    for (const imageName of images) {
      const image = await page.objs.get(imageName);

      // Analyze image with GPT-4 Vision
      const analysis = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image and extract any text, tables, or diagrams.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${image.data}` } }
          ]
        }]
      });

      // Store image analysis as chunk
      await ingestChunk({
        text: analysis.choices[0].message.content,
        metadata: {
          type: 'image',
          page: i,
          imageIndex: images.indexOf(imageName)
        }
      });
    }
  }
}
```

**Priority**: **MEDIUM** - Nice-to-have for technical/medical documents

---

### 3.2 Cross-Language Retrieval

**Goal**: Búsqueda cross-language como Kamium para organizaciones multilingües

**Implementation**:

```typescript
// lib/rag/cross-language.ts
async function translateQuery(query: string, sourceLang: string, targetLang: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `Translate the following ${sourceLang} query to ${targetLang}. Return ONLY the translated text.`
    }, {
      role: 'user',
      content: query
    }]
  });

  return response.choices[0].message.content;
}

async function crossLanguageSearch(query: string, sourceLang: string) {
  const supportedLangs = ['en', 'de', 'es', 'fr'];

  // Translate query to all supported languages
  const translatedQueries = await Promise.all(
    supportedLangs.map(lang =>
      lang !== sourceLang ? translateQuery(query, sourceLang, lang) : query
    )
  );

  // Search in all languages
  const results = await Promise.all(
    translatedQueries.map(q => hybridSearch(q, { lang: targetLang }))
  );

  // Merge and rerank results
  const mergedResults = mergeAndRerank(results);

  return mergedResults;
}
```

**Priority**: **LOW** - Nice-to-have for international organizations

---

### 3.3 Auto-Tuning of Chunking Parameters

**Goal**: Optimización automática de chunking como Kamium

**Implementation**:

```typescript
// lib/rag/chunking-optimizer.ts
async function evaluateChunkingQuality(chunks: Chunk[], groundTruth: QA[]) {
  const scores = await Promise.all(
    groundTruth.map(async qa => {
      const results = await hybridSearch(qa.question, {
        documentIds: qa.documentId
      });

      const relevantChunks = results.filter(r =>
        qa.answerRelevantChunks.includes(r.chunkId)
      );

      const precision = relevantChunks.length / results.length;
      const recall = relevantChunks.length / qa.answerRelevantChunks.length;

      return { precision, recall, f1: 2 * precision * recall / (precision + recall) };
    })
  );

  const avgF1 = scores.reduce((sum, s) => sum + s.f1, 0) / scores.length;
  return avgF1;
}

async function optimizeChunkingParameters(documentId: string) {
  const parameters = [
    { maxChunkSize: 1200, overlap: 200 },
    { maxChunkSize: 1000, overlap: 150 },
    { maxChunkSize: 800, overlap: 100 },
    { maxChunkSize: 600, overlap: 80 },
    { maxChunkSize: 400, overlap: 50 },
  ];

  const scores = await Promise.all(
    parameters.map(async params => {
      const chunks = await rechunkDocument(documentId, params);
      const quality = await evaluateChunkingQuality(chunks, groundTruthQA);
      return { params, quality };
    })
  );

  const best = scores.sort((a, b) => b.quality - a.quality)[0];
  return best.params;
}
```

**Priority**: **LOW** - Advanced feature for power users

---

## Implementation Priority Summary

| Priority | Feature | Impact | Effort | Timeline |
|----------|---------|--------|--------|----------|
| **P0 - CRITICAL** | Advanced Search UI with Filters | HIGH | MEDIUM | Week 1 |
| **P0 - CRITICAL** | Enhanced Citations with Page Numbers | HIGH | MEDIUM | Week 2 |
| **P0 - CRITICAL** | Usage Analytics Dashboard | HIGH | MEDIUM | Week 3 |
| **P1 - HIGH** | SharePoint Connector | HIGH | HIGH | Week 4-5 |
| **P1 - HIGH** | Entity Extraction | MEDIUM | HIGH | Week 5-6 |
| **P2 - MEDIUM** | Slack/Teams Integration | MEDIUM | MEDIUM | Week 6 |
| **P2 - MEDIUM** | Database Connector | MEDIUM | HIGH | Week 7-8 |
| **P3 - LOW** | Multimodal RAG | LOW | HIGH | Week 9 |
| **P3 - LOW** | Cross-Language Retrieval | LOW | MEDIUM | Week 9 |
| **P3 - LOW** | Auto-Tuning Chunking | LOW | HIGH | Week 10 |

---

## Metrics for Success

### Technical Metrics
- Search latency < 500ms (p95)
- Cache hit rate > 30%
- Relevance score (NDCG@10) > 0.75
- Query success rate > 98%

### Business Metrics
- Monthly active users (MAU) growth rate
- Queries per user per day (avg > 10)
- Document ingestion rate
- User satisfaction (NPS > 50)

### Competitive Metrics
- Feature parity with Kamium/Logicc: 90%+
- Compliance advantage: §203 StGB + HIPAA (unique)
- Pricing advantage: 20-30% cheaper than competitors
- Time-to-value: < 1 week onboarding (competitive)

---

## Go-to-Market Strategy

### Target Customers (DACH)
1. **Legal firms** - §203 StGB compliance + BM25 for legal search
2. **Healthcare providers** - HIPAA compliance + medical document search
3. **Mid-market enterprises** - GDPR + SOC 2 + SSO/SCIM
4. **Consulting firms** - Knowledge management for client projects

### Pricing Strategy
| Tier | Monthly Price | Features |
|------|--------------|----------|
| Starter | €25/user or €5K flat | Basic RAG, 5GB storage, web connector |
| Professional | €40/user or €25K flat | Advanced search, 50GB storage, Notion/Confluence |
| Enterprise | €60/user or €100K flat | SharePoint connector, SAML/SCIM, §203 StGB compliance |
| Healthcare/Legal | €80/user or €150K flat | HIPAA compliance, PHI tracking, eDiscovery |

### Value Proposition
> "Enterprise RAG Platform with Hybrid Search (Vectorial + BM25), §203 StGB/HIPAA/SOC 2 Compliance, and Knowledge Graph - The only GDPR-compliant knowledge platform designed for DACH legal and healthcare industries."

---

## Next Actions

1. **Week 1**: Start with Advanced Search UI
   - Create `components/rag/advanced-search-bar.tsx`
   - Enhance `/api/rag/search/advanced` with filters
   - Create database schema for facets

2. **Week 2**: Implement Enhanced Citations
   - Extract page numbers from PDFs
   - Create citation components
   - Link citations to document viewer

3. **Week 3**: Build Analytics Dashboard
   - Create `rag_query_logs` table
   - Build `/app/(authenticated)/dashboard/analytics/rag/page.tsx`
   - Implement `/api/admin/rag/analytics/route.ts`

4. **Week 4-5**: SharePoint Connector
   - Implement OAuth 2.0 flow with Microsoft Graph
   - Create connector UI
   - Implement sync scheduler

5. **Week 5-6**: Entity Extraction
   - Use GPT-4o-mini for NER
   - Store entities in database
   - Enhance knowledge graph visualization

---

## Conclusion

Nexary has an **exceptional RAG architecture** that is technically competitive with Kamium/Logicc. The gaps are primarily in **UX and product features**. By implementing the roadmap above, Nexary can:

1. **Differentiate with BM25** - Hybrid search that no competitor has
2. **Win on compliance** - §203 StGB + HIPAA + SOC 2 (unique in DACH)
3. **Compete on UX** - Advanced search UI, citations, analytics
4. **Enterprise-ready** - SAML/SCIM, RBAC, audit logs

**Timeline to competitive parity**: 6-9 weeks for critical features, 10-12 weeks for full feature parity.

**Investment required**: ~$20K-$30K for P0-P1 features (similar to enterprise security PR).

**ROI potential**: €150K-€500K valuation uplift with full RAG platform capabilities.
