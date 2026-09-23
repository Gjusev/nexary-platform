# 📘 Guía Completa de Enterprise SSO por Tenant

Guía exhaustiva del sistema de autenticación enterprise SSO multi-tenant en Nexary.

---

## 📑 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Configuración por Tenant](#3-configuración-por-tenant)
4. [Métodos de Login](#4-métodos-de-login)
5. [Flujos de Autenticación](#5-flujos-de-autenticación)
6. [Unified Auth Router](#6-unified-auth-router)
7. [URLs y Endpoints](#7-urls-y-endpoints)
8. [Configuración de Identity Providers](#8-configuración-de-identity-providers)
9. [Ejemplos Prácticos](#9-ejemplos-prácticos)
10. [Implementación Frontend](#10-implementación-frontend)
11. [Testing](#11-testing)
12. [Troubleshooting](#12-troubleshooting)
13. [Checklists](#13-checklists)

---

## 1. Visión General

Nexary soporta **autenticación enterprise SSO** multi-tenant con dos protocolos:

| Protocolo | Descripción | Casos de uso |
|-----------|-------------|--------------|
| **SAML 2.0** | Security Assertion Markup Language | Enterprise tradicional (Okta, Azure AD, Google Workspace) |
| **OIDC** | OpenID Connect | Moderno, basado en OAuth 2.0 (Authentik como broker) |

### Características Principales

✅ **Multi-tenant**: Cada equipo (tenant) tiene su propia configuración
✅ **Router inteligente**: Decide automáticamente SAML vs OIDC
✅ **Migración gradual**: Soporta migración SAML→OIDC con modos shadow/canary/full
✅ **Link único**: Un link por cliente funciona para ambos protocolos
✅ **Admin UI**: Interfaz para configurar SAML y SCIM por equipo

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXARY                                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                        FRONTEND LAYER                              │    │
│  │  /login?team=acme-corp                                             │    │
│  └────────────────────────┬───────────────────────────────────────────┘    │
│                           ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                   UNIFIED AUTH ROUTER                              │    │
│  │              /api/enterprise-auth/[teamSlug]                      │    │
│  │                                                                    │    │
│  │  - Verifica configuración del team                                │    │
│  │  - Consulta feature flags                                         │    │
│  │  - Decide: SAML | OIDC | none                                     │    │
│  └────────┬───────────────────────┬──────────────────────────────────┘    │
│           │                       │                                       │
│      SAML │                   OIDC │                                       │
│           ▼                       ▼                                       │
│  ┌──────────────────┐    ┌──────────────────┐                            │
│  │   SAML FLOW      │    │   OIDC FLOW      │                            │
│  │ /api/saml/...    │    │ /api/oidc/...    │                            │
│  └────────┬─────────┘    └────────┬─────────┘                            │
│           │                       │                                       │
│           ▼                       ▼                                       │
│  ┌──────────────────┐    ┌──────────────────┐                            │
│  │  SAML PROVIDER   │    │  OIDC PROVIDER   │                            │
│  │  - passport-saml │    │  - openid-client │                            │
│  │  - Genera SAMLRequest│  │  - PKCE (S256)   │                            │
│  └────────┬─────────┘    └────────┬─────────┘                            │
│           │                       │                                       │
│           ▼                       ▼                                       │
│  ┌──────────────────────────────────────────────────┐                    │
│  │           IDENTITY PROVIDER (IdP)               │                    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │                    │
│  │  │  Okta   │  │ Azure AD│  │  Authentik     │  │                    │
│  │  │ (SAML)  │  │ (SAML)  │  │   (OIDC)       │  │                    │
│  │  └────┬────┘  └────┬────┘  └────────┬────────┘  │                    │
│  └───────┼────────────┼─────────────────┼───────────┘                    │
│          │            │                 │                               │
│          └────────────┴─────────────────┘                               │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     CALLBACK HANDLERS                            │   │
│  │  ┌──────────────────┐      ┌──────────────────┐                  │   │
│  │  │  /api/saml/acs   │      │/api/oidc/callback│                  │   │
│  │  │  - Valida firma  │      │  - Valida state  │                  │   │
│  │  │  - Extrae perfil │      │  - Tokens       │                  │   │
│  │  │  - Crea usuario  │      │  - ID Token     │                  │   │
│  │  └────────┬─────────┘      └────────┬─────────┘                  │   │
│  └───────────┼──────────────────────────┼────────────────────────────┘   │
│              ▼                          ▼                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      STACK AUTH ADAPTER                          │   │
│  │  - getOrCreateStackAuthUser()                                   │   │
│  │  - createStackAuthSession()                                     │   │
│  │  - ensureTeamMembership()                                       │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      DATABASE                                    │   │
│  │  teams | team_members | user_identities | saml_configurations   │   │
│  │        | oidc_configurations | oidc_sessions | oidc_audit_logs    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Configuración por Tenant

### 3.1 Tablas de Base de Datos

#### Tabla Principal: `teams`

```sql
CREATE TABLE projectnexus.teams (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,              -- Identificador único (ej: "acme-corp")
  name TEXT NOT NULL,
  sso_type TEXT DEFAULT 'none',           -- 'none' | 'saml' | 'oidc' | 'both'
  enterprise_auth_enabled BOOLEAN DEFAULT false
);
```

#### Configuración SAML: `saml_configurations`

```sql
CREATE TABLE projectnexus.saml_configurations (
  id UUID PRIMARY KEY,
  team_slug TEXT REFERENCES teams(slug),
  idp_entity_id TEXT NOT NULL,            -- IdP Entity ID
  idp_sso_url TEXT NOT NULL,             -- URL del IdP para login
  idp_slo_url TEXT,                      -- URL del IdP para logout (opcional)
  idp_cert TEXT NOT NULL,                -- Certificado X.509 del IdP
  sp_entity_id TEXT,                     -- SP Entity ID (default: APP_URL)
  acs_url TEXT,                          -- Assertion Consumer Service URL
  slo_url TEXT,                          -- Single Logout Service URL
  metadata_url TEXT,                     -- URL del metadata XML
  migration_status TEXT DEFAULT 'not_started' -- Para migración SAML→OIDC
);
```

#### Configuración OIDC: `oidc_configurations`

```sql
CREATE TABLE projectnexus.oidc_configurations (
  id UUID PRIMARY KEY,
  team_slug TEXT REFERENCES teams(slug),
  enabled BOOLEAN DEFAULT true,
  issuer TEXT NOT NULL,                  -- URL del issuer (ej: Authentik)
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['openid', 'email', 'profile'],
  authorization_endpoint TEXT,
  token_endpoint TEXT,
  userinfo_endpoint TEXT,
  jwks_uri TEXT,
  end_session_endpoint TEXT,
  pkce BOOLEAN DEFAULT true,
  token_signing_alg TEXT DEFAULT 'RS256',
  claims_mapping JSONB,
  last_used_at TIMESTAMPTZ
);
```

#### Sesiones y Audit Logs

```sql
-- Sesiones OIDC (para PKCE y state/nonce)
CREATE TABLE projectnexus.oidc_sessions (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,
  state TEXT NOT NULL,                   -- CSRF protection
  nonce TEXT NOT NULL,                  -- ID token validation
  code_verifier TEXT,
  return_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  consumed BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL
);

-- User identities (link entre IdP y Stack Auth)
CREATE TABLE projectnexus.user_identities (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,                -- Stack Auth user ID
  team_slug TEXT NOT NULL,
  idp_type TEXT NOT NULL,               -- 'saml' | 'oidc'
  idp_id TEXT NOT NULL,                 -- NameID (SAML) o sub (OIDC)
  idp_issuer TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  attributes JSONB,
  last_authenticated_at TIMESTAMPTZ
);

-- Audit logs OIDC
CREATE TABLE projectnexus.oidc_audit_logs (
  id UUID PRIMARY KEY,
  team_slug TEXT NOT NULL,
  user_id TEXT,
  flow_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Estados de Configuración

| `sso_type` | `enterprise_auth_enabled` | Comportamiento |
|------------|-------------------------|----------------|
| `none` | `false` | Solo login normal (Stack Auth) |
| `none` | `true` | Habilitado pero no configurado |
| `saml` | `true` | Usa solo SAML 2.0 |
| `oidc` | `true` | Usa solo OIDC |
| `both` | `true` | Router decide según migration mode |

---

## 4. Métodos de Login

### 4.1 Login Normal (Stack Auth)

**URL:** `https://app.nexary.com/login`

Métodos soportados:
- Google OAuth
- Email/contraseña
- Magic links
- Otros métodos de Stack Auth

### 4.2 Login Enterprise SSO

#### Opción A: Link Directo por Tenant ⭐ RECOMENDADO

**URL:** `https://app.nexary.com/login?team=acme-corp`

**Ventajas:**
- ✅ Link único y simple
- ✅ Router decide automáticamente SAML vs OIDC
- ✅ Soporta migración gradual
- ✅ No cambia aunque el equipo migre de SAML a OIDC

**Qué hace:**
1. Frontend detecta parámetro `team`
2. Llama a `POST /api/enterprise-auth/acme-corp`
3. Router verifica configuración y devuelve la URL correcta
4. Usuario es redirigido al IdP correspondiente

#### Opción B: Link SAML Específico

**URL:** `https://app.nexary.com/login?saml=acme-corp`

**Ventajas:**
- ✅ Fuerza uso de SAML específicamente
- ✅ Útil para debugging o testing

**Desventajas:**
- ❌ No soporta migración a OIDC
- ❌ Deja de funcionar si el equipo migra

#### Opción C: Link OIDC Específico

**URL:** `https://app.nexary.com/login?oidc=acme-corp`

**Ventajas:**
- ✅ Fuerza uso de OIDC específicamente
- ✅ Útil para canary testing

**Desventajas:**
- ❌ No funciona si el equipo solo tiene SAML

---

## 5. Flujos de Autenticación

### 5.1 Flujo SAML Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 1: Usuario accede al link                                            │
│                                                                         │
│  URL: https://app.nexary.com/login?team=acme-corp                       │
│  ↓                                                                         │
│  Frontend detecta parámetro ?team                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 2: Frontend inicia autenticación                                     │
│                                                                         │
│  POST /api/enterprise-auth/acme-corp                                     │
│  Body: { "returnUrl": "/dashboard" }                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 3: Unified Auth Router decide método                                │
│                                                                         │
│  - Verifica teams.enterprise_auth_enabled = true                        │
│  - Verifica teams.sso_type = 'saml'                                     │
│  - Verifica saml_configurations existe                                  │
│  - Verifica OIDC_MIGRATION_MODE = 'off' | 'shadow'                     │
│  ↓                                                                         │
│  Decisión: Usar SAML                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 4: Init SAML Login                                                  │
│                                                                         │
│  POST /api/saml/acme-corp/login                                          │
│                                                                         │
│  SAML Provider:                                                          │
│    - Genera relay_state (contiene teamSlug + returnUrl + nonce)          │
│    - Genera SAMLRequest (AuthnRequest)                                   │
│    - Firma con certificado SP (si está configurado)                      │
│    - Construye URL del IdP                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 5: Response con redirect URL                                       │
│                                                                         │
│  {                                                                       │
│    "redirectUrl": "https://dev123456.okta.com/app/dev123456/sso/saml?   │
│                     SAMLRequest=...",                                    │
│    "relayState": "base64_encoded_state"                                 │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 6: Frontend redirige al IdP                                        │
│                                                                         │
│  window.location.href = redirectUrl                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 7: Usuario se autentica en el IdP                                  │
│                                                                         │
│  - Usuario llega a Okta/Azure AD/Google Workspace                       │
│  - Ingresa credenciales                                                  │
│  - IdP valida credenciales                                              │
│  - IdP genera SAMLResponse (firmada con certificado del IdP)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 8: IdP envía SAMLResponse al ACS                                   │
│                                                                         │
│  POST /api/saml/acs                                                      │
│  Body: {                                                                 │
│    "SAMLResponse": "base64_encoded_saml_response",                      │
│    "RelayState": "base64_encoded_relay_state"                           │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 9: ACS Endpoint valida SAMLResponse                               │
│                                                                         │
│  /api/saml/acs → validateSAMLResponse()                                  │
│                                                                         │
│  Validaciones:                                                           │
│    ✓ Verifica relay_state (CSRF protection)                            │
│    ✓ Desencripta/verifica firma con idp_cert                          │
│    ✓ Verifica audience (SP Entity ID)                                   │
│    ✓ Verifica timestamps (NotBefore, NotOnOrAfter)                      │
│    ✓ Extrae NameID (email)                                              │
│    ✓ Extrae atributos del usuario                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 10: Crear/Actualizar usuario en Stack Auth                         │
│                                                                         │
│  Stack Auth Adapter:                                                     │
│    - Busca usuario existente por email                                   │
│    - Si no existe, crea nuevo usuario                                    │
│    - Actualiza displayName si es necesario                               │
│    - Agrega usuario al team (team_members)                               │
│    - Crea enlace en user_identities                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 11: Crear sesión                                                   │
│                                                                         │
│  - Set cookie: nexary_session                                            │
│  - Redirige a returnUrl (/dashboard)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 12: Usuario autenticado 🎉                                        │
│                                                                         │
│  Usuario ahora está en /dashboard con sesión activa                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Flujo OIDC Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 1: Usuario accede al link                                            │
│                                                                         │
│  URL: https://app.nexary.com/login?team=tech-startup                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 2: Frontend inicia autenticación                                     │
│                                                                         │
│  POST /api/enterprise-auth/tech-startup                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 3: Unified Auth Router decide método                                │
│                                                                         │
│  - Verifica teams.sso_type = 'oidc'                                     │
│  - Verifica oidc_configurations existe y enabled=true                    │
│  - Verifica OIDC_MIGRATION_MODE = 'full'                                │
│  ↓                                                                         │
│  Decisión: Usar OIDC                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 4: Init OIDC Login                                                 │
│                                                                         │
│  POST /api/oidc/tech-startup/login                                      │
│                                                                         │
│  OIDC Provider:                                                          │
│    - Discover OIDC config (/.well-known/openid-configuration)            │
│    - Genera code_verifier (random 43-char string)                        │
│    - Genera code_challenge = BASE64URL(SHA256(code_verifier))           │
│    - Genera state (random string)                                        │
│    - Genera nonce (random string)                                        │
│    - Construye authorization URL                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 5: Guardar sesión OIDC en DB                                       │
│                                                                         │
│  INSERT INTO oidc_sessions:                                              │
│    - state, nonce, code_verifier                                        │
│    - team_slug, return_url                                              │
│    - ip_address, user_agent                                             │
│    - expires_at (NOW() + 15 minutes)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 6: Response con authorization URL                                  │
│                                                                         │
│  {                                                                       │
│    "authorizationUrl": "https://authentik.example.com/application/o/     │
│                          authorize?client_id=...&                          │
│                          redirect_uri=...&                                 │
│                          response_type=code&                               │
│                          scope=openid+email+profile&                       │
│                          state=...&                                        │
│                          code_challenge=...&                              │
│                          code_challenge_method=S256"                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 7: Frontend redirige al IdP                                        │
│                                                                         │
│  window.location.href = authorizationUrl                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 8: Usuario se autentica en Authentik                               │
│                                                                         │
│  - Usuario llega a Authentik                                            │
│  - Ingresa credenciales                                                  │
│  - Authentik valida credenciales                                         │
│  - Authentik genera authorization code                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 9: Authentik redirige al callback                                 │
│                                                                         │
│  GET /api/oidc/callback?code=...&state=...                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 10: Callback endpoint valida y procesa                             │
│                                                                         │
│  /api/oidc/callback → Validaciones:                                      │
│    ✓ Verifica state contra oidc_sessions                                │
│    ✓ Verifica sesión no expiró                                          │
│    ✓ Marca sesión como consumed                                         │
│    ✓ Intercambia code por tokens (POST to token_endpoint)               │
│    ✓ Valida ID token:                                                   │
│      - Verifica firma (JWK desde jwks_uri)                              │
│      - Verifica iss (issuer)                                            │
│      - Verifica aud (client_id)                                         │
│      - Verifica exp (expiration)                                        │
│      - Verifica nonce                                                   │
│    ✓ Extrae claims del usuario (email, name, etc.)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 11: Crear/Actualizar usuario en Stack Auth                         │
│                                                                         │
│  Stack Auth Adapter:                                                     │
│    - Busca identidad existente por email + issuer + subject              │
│    - Si no existe:                                                       │
│      - Crea usuario en Stack Auth                                       │
│      - Agrega al team                                                    │
│      - Crea enlace en user_identities                                   │
│    - Si existe:                                                         │
│      - Actualiza last_seen_at                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 12: Crear sesión                                                   │
│                                                                         │
│  - Crea sesión de Stack Auth                                            │
│  - Set cookie de sesión                                                 │
│  - Redirige a returnUrl (/dashboard)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASO 13: Usuario autenticado 🎉                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Flujo con Migración SAML → OIDC

Cuando `sso_type = 'both'` el router decide basado en el **migration mode**:

| Migration Mode | Comportamiento | ¿Qué usa el usuario? |
|----------------|----------------|---------------------|
| `off` | OIDC deshabilitado | SAML |
| `shadow` | Prueba OIDC sin afectar | SAML |
| `canary` | X% de usuarios usan OIDC | Depende del hash del email |
| `full` | SAML deshabilitado | OIDC |

**Ejemplo Canary (20%):**

```typescript
// Algoritmo de decisión canary
function isInCanary(teamSlug: string, userEmail: string): boolean {
  const canaryPercent = 20; // 20%

  // Hash consistente del email
  let hash = 0;
  for (let i = 0; i < userEmail.length; i++) {
    const char = userEmail.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit
  }
  const score = Math.abs(hash) % 100;

  return score < canaryPercent; // true si score < 20
}

// Ejemplos:
isInCanary('acme-corp', 'alice@acme.com')  // score = 15 → true → OIDC
isInCanary('acme-corp', 'bob@acme.com')    // score = 85 → false → SAML
```

---

## 6. Unified Auth Router

El router unificado es el componente central que decide qué método de autenticación usar.

### 6.1 Endpoint

```
GET/POST /api/enterprise-auth/[teamSlug]
```

### 6.2 Algoritmo de Decisión

```
function determineAuthMethod(teamSlug, userEmail?) {
  // 1. Verificar que el team existe
  if (!teamExists(teamSlug)) return 'none';

  // 2. Verificar enterprise auth habilitado
  if (!team.enterprise_auth_enabled) return 'none';

  // 3. Verificar configuraciones disponibles
  const hasSAML = saml_configurations.exists(teamSlug);
  const hasOIDC = oidc_configurations.enabled(teamSlug);

  // 4. Basado en sso_type
  switch (team.sso_type) {
    case 'none':
      return 'none';

    case 'saml':
      return hasSAML ? 'saml' : 'none';

    case 'oidc':
      return hasOIDC ? 'oidc' : 'none';

    case 'both':
      // Consultar migration mode
      const mode = getOIDCMigrationMode(teamSlug);

      switch (mode) {
        case 'off':
        case 'shadow':
          return hasSAML ? 'saml' :
                 hasOIDC ? 'oidc' : 'none';

        case 'canary':
          if (userEmail && isInCanary(teamSlug, userEmail))
            return hasOIDC ? 'oidc' : 'saml';
          return hasSAML ? 'saml' :
                 hasOIDC ? 'oidc' : 'none';

        case 'full':
          return hasOIDC ? 'oidc' :
                 hasSAML ? 'saml' : 'none';
      }
  }
}
```

### 6.3 Response Examples

**GET Response (información):**
```json
{
  "teamSlug": "acme-corp",
  "method": "saml",
  "reason": "Team configured for SAML only",
  "migrationMode": "off"
}
```

**POST Response (inicia auth):**
```json
{
  "method": "saml",
  "redirectUrl": "https://dev123456.okta.com/app/dev123456/sso/saml?SAMLRequest=...",
  "reason": "Team configured for SAML only",
  "migrationMode": "off"
}
```

---

## 7. URLs y Endpoints

### 7.1 Endpoints de Autenticación

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/enterprise-auth/[teamSlug]` | GET | Info de qué método se usará |
| `/api/enterprise-auth/[teamSlug]` | POST | Inicia autenticación (router decide) |
| `/api/saml/[teamSlug]/login` | POST | Inicia flujo SAML |
| `/api/saml/[teamSlug]/login` | GET | Inicia flujo SAML (alternative) |
| `/api/oidc/[teamSlug]/login` | POST | Inicia flujo OIDC |
| `/api/saml/acs` | POST | Callback SAML |
| `/api/oidc/callback` | GET | Callback OIDC |
| `/api/oidc/logout` | POST | Logout OIDC |

### 7.2 Endpoints de Configuración

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/saml/config` | POST | Crear configuración SAML |
| `/api/saml/config` | PUT | Actualizar configuración SAML |
| `/api/saml/config` | GET | Obtener configuración SAML |
| `/api/saml/config` | DELETE | Eliminar configuración SAML |
| `/api/oidc/config` | POST | Crear configuración OIDC |
| `/api/oidc/config` | PUT | Actualizar configuración OIDC |
| `/api/oidc/config` | GET | Obtener configuración OIDC |
| `/api/oidc/config` | DELETE | Eliminar configuración OIDC |
| `/api/saml/metadata/[teamSlug]` | GET | Metadata XML del SP |

### 7.3 Endpoints de Migración

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/migrations/[teamSlug]` | GET | Obtener status de migración |
| `/api/admin/migrations/[teamSlug]` | POST | Iniciar/actualizar migración |
| `/api/admin/migrations/[teamSlug]` | DELETE | Rollback de migración |

### 7.4 Endpoints de Admin

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/teams` | GET | Listar todos los equipos |
| `/api/admin/teams` | POST | Crear nuevo equipo |
| `/api/scim/logs` | GET | Logs de sincronización SCIM |

### 7.5 URLs de Login

| Tipo | URL | Uso |
|------|-----|-----|
| **Router automático** | `https://app.nexary.com/login?team={slug}` | ⭐ Recomendado |
| **SAML específico** | `https://app.nexary.com/login?saml={slug}` | Forzar SAML |
| **OIDC específico** | `https://app.nexary.com/login?oidc={slug}` | Forzar OIDC |
| **Login normal** | `https://app.nexary.com/login` | Sin enterprise SSO |

---

## 8. Configuración de Identity Providers

### 8.1 Okta

#### Paso 1: Crear Aplicación SAML

1. Ir a **Applications** → **Applications**
2. Click en **Create App Integration**
3. Seleccionar **SAML 2.0**
4. Configurar:

**General Settings:**
```
App name: Nexary - Acme Corp
App logo: (opcional)
```

**Configure SAML:**
```
Single sign-on URL: https://app.nexary.com/api/saml/acs
Audience URI (SP Entity ID): https://app.nexary.com
Default RelayState: /dashboard
Name ID format: EmailAddress
Application username: Email
```

**Attribute Statements:**
```
displayName: user.displayName
firstName: user.firstName
lastName: user.lastName
```

#### Paso 2: Obtener Certificado y URLs

En **Sign On** section de la aplicación Okta:
- **Identity Provider Single Sign-On URL** → `idpSsoUrl`
- **Identity Provider Issuer** → `idpEntityId`
- **X.509 Certificate** → `idpCert`

### 8.2 Azure AD (Entra ID)

#### Paso 1: Registrar Aplicación

1. Ir a **Azure Active Directory** → **Enterprise applications**
2. **New application** → **Create your own application**
3. Nombre: `Nexary - Acme Corp`

#### Paso 2: Configurar SAML

1. En la aplicación, ir a **Single sign-on**
2. Seleccionar **SAML**
3. Editar **Basic SAML Configuration**:

```
Identifier (Entity ID): https://app.nexary.com
Reply URL (ACS URL): https://app.nexary.com/api/saml/acs
Sign on URL: https://app.nexary.com/login
Relay State: /dashboard
```

4. En **SAML Signing Certificate**:
   - Download **Certificate (Base64)**

5. Copiar **Login URL** y **Azure AD Identifier**

### 8.3 Google Workspace

> Requiere dominio de Google Workspace (no disponible con Gmail gratuito)

#### Paso 1: Crear App SAML

1. Ir a **Admin Console** → **Apps** → **Web and mobile apps**
2. **Add app** → **Add custom SAML app**
3. Nombre: `Nexary - Acme Corp`

#### Paso 2: Configurar SP

```
ACS URL: https://app.nexary.com/api/saml/acs
Entity ID: https://app.nexary.com
Name ID: Primary email
Name ID Format: EMAIL
```

#### Paso 3: Configurar Attributes

```
Primary email: Basic Information > Primary email
First name: Basic Information > First name
Last name: Basic Information > Last name
```

#### Paso 4: Obtener Certificado

Download certificate desde **Service provider details**

### 8.4 Authentik (para OIDC)

Authentik actúa como **OIDC broker** entre Nexary y otros IdPs.

#### Configuración en Nexary

```
Issuer: https://authentik.example.com/application/o/team-slug/
Client ID: nexary-team-slug
Client Secret: (generado por Authentik)
Scopes: openid, email, profile
Authorization Endpoint: https://authentik.example.com/application/o/authorize/
Token Endpoint: https://authentik.example.com/application/o/token/
JWKS URI: https://authentik.example.com/application/o/jwks/
```

---

## 9. Ejemplos Prácticos

### Ejemplo 1: Cliente Solo SAML (Okta)

**Requisitos:**
- Team slug: `acme-corp`
- Okta developer account

**Configuración DB:**
```sql
-- Crear team
INSERT INTO projectnexus.teams (id, slug, name, sso_type, enterprise_auth_enabled)
VALUES (
  gen_random_uuid(),
  'acme-corp',
  'ACME Corporation',
  'saml',
  true
);

-- Configurar SAML
INSERT INTO projectnexus.saml_configurations (
  id, team_slug, idp_entity_id, idp_sso_url, idp_cert
)
VALUES (
  gen_random_uuid(),
  'acme-corp',
  'http://www.okta.com/exk123456789',
  'https://dev123456.okta.com/app/dev123456_789/sso/saml',
  '-----BEGIN CERTIFICATE-----
MIIDxTCCAk2gAwIBAgIJK...
-----END CERTIFICATE-----'
);
```

**Link para el cliente:**
```
https://app.nexary.com/login?team=acme-corp
```

**Prueba:**
```bash
# Ver qué método se usará
curl https://app.nexary.com/api/enterprise-auth/acme-corp

# Iniciar login
curl -X POST https://app.nexary.com/api/saml/acme-corp/login \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "/dashboard"}'
```

### Ejemplo 2: Cliente Solo OIDC (Authentik)

**Requisitos:**
- Team slug: `tech-startup`
- Authentik instalado

**Configuración DB:**
```sql
-- Crear team
INSERT INTO projectnexus.teams (id, slug, name, sso_type, enterprise_auth_enabled)
VALUES (
  gen_random_uuid(),
  'tech-startup',
  'Tech Startup Inc',
  'oidc',
  true
);

-- Configurar OIDC
INSERT INTO projectnexus.oidc_configurations (
  id, team_slug, enabled, issuer, client_id, client_secret,
  authorization_endpoint, token_endpoint, jwks_uri
)
VALUES (
  gen_random_uuid(),
  'tech-startup',
  true,
  'https://authentik.example.com/application/o/tech-startup/',
  'nexary-tech-startup',
  'secret-random-key',
  'https://authentik.example.com/application/o/authorize/',
  'https://authentik.example.com/application/o/token/',
  'https://authentik.example.com/application/o/jwks/'
);
```

**Link para el cliente:**
```
https://app.nexary.com/login?team=tech-startup
```

### Ejemplo 3: Migración SAML → OIDC (Canary 20%)

**Configuración DB:**
```sql
-- Team con ambos protocolos
UPDATE projectnexus.teams
SET sso_type = 'both'
WHERE slug = 'enterprise-inc';

-- Feature flag de migración
INSERT INTO projectnexus.feature_flags (flag, team_slug, enabled, value)
VALUES (
  'OIDC_MIGRATION_MODE',
  'enterprise-inc',
  true,
  'canary'  -- can be: 'off', 'shadow', 'canary', 'full'
);

-- Porcentaje canary
INSERT INTO projectnexus.feature_flags (flag, team_slug, enabled, value)
VALUES (
  'OIDC_CANARY_PERCENT',
  'enterprise-inc',
  true,
  '20'  -- 20% de usuarios usan OIDC
);
```

**Comportamiento:**
- Usuario con email que hace hash < 20 → Usa OIDC
- Resto de usuarios → Usa SAML

**Verificar método para un usuario:**
```bash
curl "https://app.nexary.com/api/enterprise-auth/enterprise-inc?email=user@example.com"
```

---

## 10. Implementación Frontend

### 10.1 Página de Login

```typescript
// app/login/page.tsx

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener parámetros
  const team = searchParams.get('team');
  const saml = searchParams.get('saml');
  const oidc = searchParams.get('oidc');

  // Auto-iniciar login si hay parámetro
  useEffect(() => {
    if (team) {
      handleEnterpriseLogin(team);
    } else if (saml) {
      handleSAMLLogin(saml);
    } else if (oidc) {
      handleOIDCLogin(oidc);
    }
  }, [team, saml, oidc]);

  const handleEnterpriseLogin = async (teamSlug: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/enterprise-auth/${teamSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const data = await response.json();

      if (data.redirectUrl) {
        // SAML: redirigir al IdP
        window.location.href = data.redirectUrl;
      } else if (data.authorizationUrl) {
        // OIDC: redirigir al IdP
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No redirect URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const handleSAMLLogin = async (teamSlug: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/saml/${teamSlug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard' }),
      });

      const data = await response.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      setError('Failed to initiate SAML login');
      setLoading(false);
    }
  };

  const handleOIDCLogin = async (teamSlug: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/oidc/${teamSlug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard' }),
      });

      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err) {
      setError('Failed to initiate OIDC login');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Welcome to Nexary</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Login normal */}
        <button
          onClick={() => router.push('/api/auth/login')}
          className="w-full mb-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Login with Email
        </button>

        {/* Botones SSO enterprise */}
        <div className="mt-6">
          <p className="text-sm text-gray-600 mb-3 text-center">
            Or login with your enterprise account
          </p>

          <button
            onClick={() => handleEnterpriseLogin('acme-corp')}
            className="w-full mb-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Login with ACME Corp SSO
          </button>

          <button
            onClick={() => handleEnterpriseLogin('tech-startup')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Login with Tech Startup SSO
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 11. Testing

### 11.1 Test 1: Ver Configuración de Team

```bash
curl https://app.nexary.com/api/enterprise-auth/acme-corp
```

**Response esperado:**
```json
{
  "teamSlug": "acme-corp",
  "method": "saml",
  "reason": "Team configured for SAML only",
  "migrationMode": "off"
}
```

### 11.2 Test 2: Iniciar Login SAML

```bash
curl -X POST https://app.nexary.com/api/saml/acme-corp/login \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "/dashboard"}' \
  -v
```

**Response esperado:**
```json
{
  "redirectUrl": "https://dev123456.okta.com/app/dev123456_789/sso/saml?SAMLRequest=...",
  "relayState": "eyJ0ZWFtU2x1ZyI6ICJhY21lLWNvcnAiLCAicmV0dXJuVXJsIjogIi9kYXNoYm9hcmQifQ=="
}
```

### 11.3 Test 3: Iniciar Login OIDC

```bash
curl -X POST https://app.nexary.com/api/oidc/tech-startup/login \
  -H "Content-Type": application/json" \
  -d '{"returnUrl": "/dashboard"}' \
  -v
```

**Response esperado:**
```json
{
  "authorizationUrl": "https://authentik.example.com/application/o/authorize?client_id=...",
  "state": "random_state_value"
}
```

### 11.4 Test 4: Obtener Metadata SP

```bash
curl https://app.nexary.com/api/saml/metadata/acme-corp
```

**Response esperado (XML):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                      entityID="https://app.nexary.com">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                Location="https://app.nexary.com/api/saml/acs"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>
```

---

## 12. Troubleshooting

### 12.1 Errores Comunes

#### Error: "Team not configured for enterprise auth"

**Causa:** `enterprise_auth_enabled = false`

**Solución:**
```sql
UPDATE projectnexus.teams
SET enterprise_auth_enabled = true
WHERE slug = 'acme-corp';
```

#### Error: "No SAML configuration found for team"

**Causa:** No hay configuración en `saml_configurations`

**Solución:**
1. Ir a `/dashboard/admin/teams/acme-corp/saml`
2. Completar configuración SAML
3. Guardar

#### Error: "Cannot determine team slug from relay state"

**Causa:** El `RelayState` no incluye el `teamSlug`

**Solución:** Verificar que el login request incluya el teamSlug

#### Error: "SAML validation failed: Invalid signature"

**Causa:** El certificado X.509 no coincide

**Solución:**
1. Verificar que el certificado esté completo (BEGIN/END lines incluidas)
2. Asegurarse de usar el certificado correcto (signing, no encryption)
3. Verificar que no haya espacios extra

#### Error: "OIDC configuration not found or disabled"

**Causa:** Configuración OIDC no existe o `enabled = false`

**Solución:**
```sql
-- Verificar configuración
SELECT * FROM projectnexus.oidc_configurations
WHERE team_slug = 'tech-startup';

-- Habilitar si existe
UPDATE projectnexus.oidc_configurations
SET enabled = true
WHERE team_slug = 'tech-startup';
```

---

## 13. Checklists

### 13.1 Checklist para Nuevo Cliente SAML

#### Configuración en el IdP
- [ ] Registrar aplicación SAML en el IdP (Okta/Azure/Google)
- [ ] Configurar ACS URL: `https://app.nexary.com/api/saml/acs`
- [ ] Configurar SP Entity ID: `https://app.nexary.com`
- [ ] Configurar Name ID format: EmailAddress
- [ ] Configurar Attribute Statements (displayName, firstName, lastName)
- [ ] Download/obtener certificado X.509 del IdP
- [ ] Copiar IdP Entity ID y SSO URL

#### Configuración en Nexary
- [ ] Crear team en `teams` table
- [ ] Configurar `sso_type = 'saml'`
- [ ] Configurar `enterprise_auth_enabled = true`
- [ ] Guardar configuración SAML en `saml_configurations`
- [ ] Testear login completo end-to-end
- [ ] Verificar que usuario se agrega al team

#### Entregables al Cliente
- [ ] Link de login: `https://app.nexary.com/login?team={slug}`
- [ ] Link de metadata: `https://app.nexary.com/api/saml/metadata/{slug}`
- [ ] ACS URL: `https://app.nexary.com/api/saml/acs`
- [ ] SP Entity ID: `https://app.nexary.com`

### 13.2 Checklist para Migración SAML → OIDC

#### Preparación
- [ ] Configurar OIDC en Authentik
- [ ] Crear `oidc_configurations` para el team
- [ ] Cambiar `sso_type` a `'both'`
- [ ] Configurar feature flag `OIDC_MIGRATION_MODE = 'shadow'`

#### Shadow Mode
- [ ] Verificar que SAML funciona normalmente
- [ ] Verificar logs de OIDC (sin afectar usuarios)
- [ ] Monitorear errores de OIDC

#### Canary Mode
- [ ] Configurar `OIDC_CANARY_PERCENT` (empezar con 5-10%)
- [ ] Cambiar `OIDC_MIGRATION_MODE = 'canary'`
- [ ] Monitorear login success rate
- [ ] Verificar que usuarios canary usan OIDC
- [ ] Incrementar porcentaje gradualmente (10% → 25% → 50% → 75%)

#### Full Mode
- [ ] Cambiar `OIDC_MIGRATION_MODE = 'full'`
- [ ] Verificar todos los usuarios usan OIDC
- [ ] Monitorear por 1-2 semanas
- [ ] Si todo OK, cambiar `sso_type = 'oidc'`
- [ ] Eliminar configuración SAML (opcional)

---

## Resumen Ejecutivo

### Link Único por Cliente

```
https://app.nexary.com/login?team={team-slug}
```

Este link:
- ✅ Funciona automáticamente con SAML u OIDC
- ✅ El router detecta qué método usar
- ✅ Soporta migración gradual sin cambios
- ✅ Es simple y fácil de compartir

### Conceptos Clave

| Concepto | Valor |
|----------|-------|
| **Team Slug** | Identificador único del tenant |
| **Link de Login** | `https://app.nexary.com/login?team={slug}` |
| **Router** | `/api/enterprise-auth/{slug}` |
| **SAML Flow** | Login → IdP → ACS → Dashboard |
| **OIDC Flow** | Login → IdP → Callback → Dashboard |
| **Migración** | off → shadow → canary (%) → full |

### URLs del SP (para configurar IdP)

```
ACS URL:         https://app.nexary.com/api/saml/acs
SP Entity ID:    https://app.nexary.com
Metadata:        https://app.nexary.com/api/saml/metadata/{slug}
```

---

**Documento versión:** 1.0
**Última actualización:** 2026-01-05
**Autores:** Nexary Team
