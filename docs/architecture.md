# Architecture

Nexary is a single Next.js application (App Router, TypeScript strict) plus a
docker-compose private-cloud topology: the app, PostgreSQL, Qdrant, Redis,
MinIO, nginx and a backup sidecar on one internal network. It runs behind a
customer's own TLS edge, inside a network that may forbid all egress.

## System

```mermaid
flowchart TB
    subgraph CustomerLAN[customer network · no public egress required]
        NGINX[nginx<br/>TLS · internal routes]
        subgraph Stack
            APP[Nexary · Next.js 15]
            PG[(PostgreSQL 15)]
            QD[(Qdrant)]
            RD[(Redis)]
            MO[(MinIO)]
            BKP[backup sidecar]
        end
        NGINX --> APP
        APP --- PG & QD & RD & MO
        BKP --- PG
        IDP[Authentik / Keycloak / ADFS<br/>SAML 2.0 · OIDC] --> APP
        SIEM[customer SIEM] <-- SYSLOG --- APP
    end
    OCR[OCR microservice<br/>scans → text] --> APP
    APP -.->|only if egress is allowed| LLM[OpenAI · Anthropic ·<br/>Mistral · Gemini · Aleph Alpha]
    APP --> SENTRY[Sentry self-host or none]
```

## The decisions that matter

### Hybrid retrieval, not dense-only

Dense embeddings fail on exact identifiers — statute numbers, contract IDs,
product codes — precisely the tokens legal and compliance queries hinge on.
The RAG pipeline therefore:

1. chunks semantically (structure-aware splitting, not fixed windows),
2. retrieves **dense** (Qdrant) and **BM25** (PostgreSQL full-text) in
   parallel,
3. fuses candidate lists,
4. **cross-encoder reranks** the fused top-k,
5. passes the survivors as cited context to the model.

The lexical arm costs little and rescues query classes embeddings cannot
see. Verdict after production use: hybrid + rerank is the floor, not an
optimization.

### Multi-provider behind one abstraction

OpenAI, Anthropic, Mistral, Gemini and Aleph Alpha sit behind a single
provider interface. Motivations: no vendor lock-in for the customer,
per-conversation model choice, and graceful degradation when a provider (or
the egress path to it) disappears. Token usage and cost are tracked per user
and team from the same seam.

### Compliance as architecture

- Every meaningful action writes an audit row; audit streams export via
  **SYSLOG** to the customer's SIEM — the integration regulated IT teams
  actually operate.
- STGB §203 (German professional secrecy) constraints are documented as
  engineering requirements: [`compliance/stgb203-compliance.md`](compliance/stgb203-compliance.md).
- SSO via SAML 2.0 / OIDC (Authentik, Keycloak) with role-based permissions
  and organization scoping — the customer's identity provider is the only
  identity source.

### Ingestion

PDF, office formats and images; scanned material goes through a dedicated
OCR microservice before chunking. Originals live in MinIO; extracted text
and chunk metadata in PostgreSQL; embeddings in Qdrant. Re-embedding after
a model change is a pipeline run, not a migration.

### Operations

Sentry (client/edge/server), structured logging, health endpoints, and a
backup sidecar for Postgres. `k8s/` carries the manifests for Kubernetes
customers; `docker-compose.private-cloud.yml` is the reference topology for
single-host deployments.

## Repository map

| Path | Contents |
|---|---|
| `app/`, `components/`, `hooks/` | Next.js App Router UI (6+ UI languages) |
| `lib/` | Domain logic: provider abstraction, retrieval, audit |
| `migrations/` | Database migrations |
| `docs/` | Architecture, compliance, setup guides, demo script |
| `e2e/`, `test/` | Playwright e2e and unit tests |
| `docker-compose.private-cloud.yml`, `Dockerfile`, `k8s/` | Deployment |
