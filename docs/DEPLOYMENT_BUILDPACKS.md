# Guía de Despliegue con Buildpacks para Nexary

## Estado de los Buildpacks (2025)

### Heroku Buildpacks (Obsoleto desde Noviembre 2023)

⚠️ **IMPORTANTE**: Heroku discontinuó su servicio en noviembre de 2023. Si estás buscando alternativas, considera:
- **Railway** (usa Nixpacks)
- **Render** (usa Docker o buildpacks)
- **Fly.io** (usa Docker)
- **Vercel** (plataforma nativa Next.js)

Sin embargo, muchas plataformas todavía usan el formato "buildpack" incluyendo Nixpacks.

### Nixpacks (Activo y Recomendado)

**Nixpacks** es el sistema de build moderno creado por Railway. Es 100% compatible con proyectos Next.js que usan Bun.

---

## Nixpacks - Configuración Completa

### ¿Qué es Nixpacks?

Nixpacks es una herramienta que convierte automáticamente tu código fuente en una imagen de Docker. Soporta:
- ✅ Bun, Node.js, Python, Go, Rust, y más
- ✅ Detección automática del runtime
- ✅ Build caching para despliegues rápidos
- ✅ Soporte para monorepos
- ✅ Variables de entorno automáticas

### Configuración Básica con Bun

Nixpacks detecta automáticamente `bun.lock` y usa Bun para el build. Solo necesitas:

#### 1. Asegurarte de tener `bun.lock`

```bash
# Ya generado por el script de migración
ls -la bun.lock
```

#### 2. Archivo `nixpacks.toml` (Opcional pero Recomendado)

Crea `nixpacks.toml` en la raíz del proyecto:

```toml
# nixpacks.toml - Configuración de Nixpacks para Nexary

[phases.build]
# Usa Bun para el build
cmds = ["bun run build"]

[phases.start]
# Usa Node.js para producción (estabilidad)
cmds = ["node .next/standalone/server.js"]

[variables]
# Variables de entorno para el build
NODE_ENV = "production"
PORT = "3000"

# Dependencias específicas que Nixpacks debe instalar
[phases.install]
# Nixpacks detecta automáticamente bun.lock y usa Bun
# No necesitas configuraciones adicionales

# Configuración del proveedor
[provider]
# Forzar uso de Bun (opcional, Nixpacks lo detecta automáticamente)
name = "bun"
```

### Plataformas que Usan Nixpacks

| Plataforma | Soporte Bun | Configuración |
|-----------|-------------|---------------|
| **Railway** | ✅ Nativo | Automático con `bun.lock` |
| **Render** | ✅ Via Docker | Usa `Dockerfile` |
| **Fly.io** | ✅ Via Docker | Usa `Dockerfile` |
| **CodeSandbox** | ✅ Nativo | Automático |
| **Replit** | ✅ Nativo | Automático |

---

## Railway (Recomendado - Nixpacks Nativo)

Railway es la plataforma que creó Nixpacks y tiene el mejor soporte para Bun.

### Configuración en Railway

1. **Conectar tu repositorio** a Railway
2. **Railway detecta automáticamente**:
   - `bun.lock` → Usa Bun
   - `Dockerfile` → Usa Docker (si existe)

3. **Configuración de variables de entorno** en el dashboard de Railway:

```bash
# Database
DATABASE_URL=postgresql://...

# AI Providers
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# App Settings
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://tu-app.railway.app
NEXTAUTH_SECRET=tu-secret-aqui

# Storage (opcional, Railway tiene storage integrado)
MINIO_ENDPOINT=...
```

### Railway con Bun - Ventajas

- ✅ **Detección automática** de `bun.lock`
- ✅ **Instalación 10x más rápida** de dependencias
- ✅ **Logs en tiempo real**
- ✅ **Deploy previews** para pull requests
- ✅ **Base de datos PostgreSQL** integrada
- ✅ **Redis** integrado
- ✅ **Storage S3-compatible** integrado

### Ejemplo de Configuración Railway

**Sin configuración adicional necesaria** - Railway detecta todo automáticamente.

Si necesitas configuración personalizada, usa `nixpacks.toml`:

```toml
# nixpacks.toml
[phases.build]
cmds = ["bun run build"]

[start]
cmd = "node .next/standalone/server.js"

[variables]
NODE_ENV = "production"
PORT = "3000"
```

---

## Render (Con Docker)

Render no soporta Nixpacks directamente, pero soporta Docker perfectamente.

### Configuración en Render

1. **Crear "Web Service"** en Render
2. **Conectar repositorio**
3. **Configurar**:

#### Runtime
- **Environment**: Docker
- **Dockerfile Path**: `./Dockerfile`

#### Variables de Entorno
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
# ... resto de variables
```

#### Build Command
No necesario (Dockerfile maneja todo)

#### Start Command
No necesario (Dockerfile maneja todo)

**Ventaja**: El Dockerfile optimizado con Bun funciona perfectamente en Render.

---

## Fly.io (Con Docker)

Fly.io usa Docker nativo. Tu Dockerfile optimizado funcionará perfectamente.

### Configuración en Fly.io

1. **Instalar Fly CLI**:
```bash
bunx flyctl launch
```

2. **Fly detectará** automáticamente:
   - `Dockerfile` → Lo usa para build
   - `bun.lock` → Nixpacks lo detecta

3. **Configurar `fly.toml`**:

```toml
# fly.toml
app = "nexary-app"
primary_region = "mad"

[build]
  # Usar Dockerfile optimizado con Bun
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
```

4. **Deploy**:
```bash
fly deploy
```

---

## Vercel (Next.js Nativo - Recomendado para Producción)

Vercel es la plataforma creadora de Next.js y ofrece la mejor integración.

### Ventajas de Vercel
- ✅ **Soporte nativo** para Next.js 15
- ✅ **Edge Runtime** para funciones serverless
- ✅ **Image Optimization** automática
- ✅ **Analytics** incluido
- ✅ **Preview Deployments** para cada commit
- ✅ **Zero config** para proyectos Next.js

### Configuración en Vercel

1. **Instalar Vercel CLI**:
```bash
bun i -g vercel
```

2. **Deploy**:
```bash
vercel
```

Vercel detecta automáticamente que es un proyecto Next.js y configura todo.

### Configuración Opcional `vercel.json`

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "bun install"
}
```

**Nota**: Vercel usa su propio sistema de build, no Nixpacks, pero soporta Bun perfectamente.

---

## Comparación de Plataformas

| Plataforma | Buildpack | Bun Support | Docker | Next.js Optimal | Recomendado |
|-----------|-----------|-------------|---------|-----------------|-------------|
| **Railway** | Nixpacks ✅ | Nativo ✅ | Sí | Sí | ⭐⭐⭐⭐⭐ |
| **Vercel** | Propio | Nativo ✅ | Sí | Sí ⭐ | ⭐⭐⭐⭐⭐ |
| **Render** | Propio | Via Docker | Sí | Sí | ⭐⭐⭐⭐ |
| **Fly.io** | No | Via Docker | Sí ⭐ | Sí | ⭐⭐⭐⭐ |
| **Heroku** | Obsoleto ❌ | No | Sí | No | ❌ |

---

## Configuraciones Específicas por Plataforma

### Railway (Nixpacks + Bun)

```bash
# 1. Push a GitHub/GitLab
git push origin main

# 2. En Railway Dashboard:
#    - Click "New Project"
#    - Select "Deploy from GitHub repo"
#    - Elegir tu repositorio

# 3. Railway detecta automáticamente:
#    ✅ bun.lock → Usa Bun para instalar
#    ✅ package.json → Detecta scripts
#    ✅ type: "NextJS" → Configura automáticamente

# 4. Configurar variables de entorno en el dashboard
```

**Sin archivos de configuración necesarios** - Railway hace todo automáticamente.

### Render (Docker + Bun)

```bash
# 1. Crear Web Service en Render
# 2. Environment: Docker
# 3. Dockerfile path: ./Dockerfile
# 4. Variables de entorno en el dashboard
```

El Dockerfile optimizado con Bun funciona perfectamente.

### Fly.io (Docker + Bun)

```bash
# 1. Instalar Fly CLI
bunx flyctl launch

# 2. Fly usará el Dockerfile que ya tiene Bun
# 3. Configurar variables:
fly secrets set DATABASE_URL=postgresql://...
fly secrets set OPENAI_API_KEY=sk-...

# 4. Deploy
fly deploy
```

---

## Troubleshooting

### Problema: "Cannot find module 'bun'"

**Causa**: La plataforma no tiene Bun instalado.

**Soluciones**:

1. **Usar Dockerfile** (recomendado):
   - Railway, Render, Fly.io soportan Docker
   - El Dockerfile usa `oven/bun:1-alpine` para build

2. **Usar Nixpacks con especificación de proveedor**:
   ```toml
   # nixpacks.toml
   [provider]
   name = "bun"
   ```

### Problema: "Build fails with Bun"

**Solución**: Usar Dockerfile con Node.js en producción:

```dockerfile
# Build con Bun
FROM oven/bun:1-alpine AS builder
RUN bun run build

# Producción con Node.js
FROM node:20-alpine AS runner
CMD ["node", "server.js"]
```

El proyecto ya tiene esta configuración en `Dockerfile`.

### Problema: "Meta tags in wrong place"

**Causa**: Usar Bun como runtime en producción (no recomendado).

**Solución**: Siempre usar Node.js como runtime:
```bash
# ❌ Incorrecto en producción
bun .next/standalone/server.js

# ✅ Correcto en producción
node .next/standalone/server.js
```

---

## Monorepos con Nixpacks

Si tu proyecto es parte de un monorepo, Nixpacks puede manejarlo:

```toml
# nixpacks.toml
[phases.build]
# Especificar el directorio de la app
cmds = ["cd apps/nexary && bun install", "cd apps/nexary && bun run build"]

[start]
cmd = "cd apps/nexary && node .next/standalone/server.js"

[variables]
ROOT_DIR = "/app/apps/nexary"
```

---

## Variables de Entorno Esenciales

### Comunes a Todas las Plataformas

```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/db

# App Settings
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://tu-dominio.com
NEXTAUTH_SECRET=tu-secret-seguro

# AI Providers
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
ANTHROPIC_API_KEY=...

# Storage (si usas MinIO/S3)
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...

# Cache
REDIS_URL=redis://...

# Vector DB
QDRANT_URL=http://qdrant:6333

# Monitoring (opcional)
SENTRY_DSN=https://...
```

---

## Buildpacks Alternativos

### Cloud Native Buildpacks (CNB)

Si usas plataformas que soportan Cloud Native Buildpacks:

```bash
# Instalar pack
brew install buildpack/tap/pack

# Build con pack
pack build nexary-app --builder heroku/builder:24
```

**Nota**: Heroku builder 24 incluye soporte para Bun.

---

## Recomendaciones Finales

### Para Desarrollo y Producción

| Caso de Uso | Plataforma | Configuración | Por Qué |
|-------------|-----------|---------------|---------|
| **Startup rápido** | Railway | Nixpacks (automático) | Zero config, Bun nativo |
| **Producción enterprise** | Vercel | Nativo Next.js | Mejor rendimiento Next.js |
| **Control total** | Fly.io | Docker | Máxima flexibilidad |
| **Costo efectivo** | Render | Docker | Buen balance precio/rendimiento |
| **On-premise** | Docker Swarm | Dockerfile | Control completo |

### Checklist de Despliegue

Antes de desplegar:

- [ ] `bun.lock` presente y commitado
- [ ] Variables de entorno configuradas
- [ ] Base de datos provisionada
- [ ] Redis provisionado (para cache)
- [ ] Qdrant disponible (para vectores)
- [ ] Storage configurado (MinIO/S3)
- [ ] `next.config.js` tiene `output: 'standalone'`
- [ ] HEALTH CHECK endpoint configurado (`/api/health`)
- [ ] Dominio configurado
- [ ] SSL/TLS habilitado

---

## Conclusión

**Sí, Nexary funcionará perfectamente con:**

- ✅ **Nixpacks** (Railway, CodeSandbox, Replit)
- ✅ **Docker** (Render, Fly.io, Railway, etc.)
- ✅ **Vercel** (mejor opción para Next.js)

**NO funcionará con:**

- ❌ **Heroku Buildpacks** (servicio discontinuado desde 2023)

**Recomendación**: Usa **Railway** (con Nixpacks automático) o **Vercel** (Next.js nativo) para la mejor experiencia con Bun.

---

**Última actualización**: Enero 8, 2026

**Documentación relacionada**:
- `docs/BUN_VS_NPM_GUIDE.md` - Comparación npm vs Bun
- `docs/BUN_OPTIMIZATION.md` - Optimización con Bun
- `Dockerfile` - Docker optimizado con Bun
