# Guía de Inicio Rápido - bun-migrate

## ¿Qué es bun-migrate?

Una herramienta CLI reutilizable que automatiza la migración de npm a Bun para cualquier proyecto Node.js.

**Beneficios principales:**
- ⚡ Instalación de dependencias 10-20x más rápida
- 🔒 Migración segura con backups automáticos
- 🐳 Optimiza Dockerfile automáticamente
- 🚀 Compatible con Railway, Render, Fly.io, etc.

## Instalación

### Opción 1: Instalación Global (Recomendado)

```bash
npm install -g bun-migrate
```

### Opción 2: Desde el Directorio Local

Si quieres probar la herramienta directamente desde `scripts/bun-migrate/`:

```bash
# Entra al directorio
cd scripts/bun-migrate

# Instala dependencias
npm install

# Enlace global para probar
npm link
```

## Uso Básico

### Migrar Cualquier Proyecto

```bash
# 1. Navega al proyecto que quieres migrar
cd /ruta/a/tu/proyecto

# 2. Ejecuta la migración
bun-migrate migrate
```

### Ejemplo Práctico

```bash
# Supongamos que quieres migrar un proyecto Next.js
cd ~/mis-proyectos/mi-app-nextjs

# Ejecuta la migración
bun-migrate migrate
```

**Resultado:**
```
🚀 Starting Bun Migration

📊 Project Diagnostics:

   Project Type: Next.js
   Package Manager: npm
   Dockerfile: ✓
   Lock Files: package-lock.json

✨ Migration Complete!

   ✓ bun.lock file
   ✓ Dockerfile optimization
   ✓ Nixpacks configuration
   ✓ Migration documentation
   ✓ Backup created

📦 Backup: /ruta/a/tu/proyecto/.bun-migrate-backup-2024-01-08T12-30-00Z

📝 Next Steps:

   1. Review the changes made
   2. Test your development environment:
      bun run dev
   3. Build for production:
      bun run build
   4. Read BUN_MIGRATION.md for deployment instructions
```

## Comandos Disponibles

### `migrate` - Migración Completa

```bash
# Migración básica
bun-migrate migrate

# Forzar migración (ignorar advertencias)
bun-migrate migrate --force

# Migrar sin optimizar Dockerfile
bun-migrate migrate --skip-docker

# Migrar sin crear backup
bun-migrate migrate --no-backup

# Migrar directorio específico
bun-migrate migrate --path ../otro-proyecto
```

### `analyze` - Analizar Proyecto

Analiza si tu proyecto es compatible con Bun sin hacer cambios:

```bash
bun-migrate analyze
```

### `lock` - Generar bun.lock

Solo genera el archivo `bun.lock`:

```bash
bun-migrate lock
```

### `docker` - Optimizar Dockerfile

Solo optimiza el Dockerfile:

```bash
bun-migrate docker
```

### `nixpacks` - Crear Configuración Nixpacks

Solo crea `nixpacks.toml`:

```bash
bun-migrate nixpacks
```

## Uso Después de la Migración

### Desarrollo

```bash
# Instalar dependencias (10-20x más rápido)
bun install

# Servidor de desarrollo
bun run dev

# Tests
bun run test

# Type checking
bun run typecheck
```

### Producción

```bash
# Build con Bun (más rápido)
bun run build

# Iniciar con Node.js (más estable)
node .next/standalone/server.js  # Next.js
node dist/main.js               # NestJS/Express
```

## Proyectos Soportados

✅ **Next.js** - Soporte completo
✅ **React** - Soporte completo
✅ **NestJS** - Soporte completo
✅ **Express** - Soporte completo
✅ **Node.js** - Soporte básico

## Archivos Creados/Modificados

1. **bun.lock** - Lock file de Bun (reemplaza package-lock.json)
2. **Dockerfile** - Optimizado para Bun (backup: Dockerfile.bak)
3. **nixpacks.toml** - Configuración para Railway, Render, etc.
4. **BUN_MIGRATION.md** - Documentación de la migración
5. **.bun-migrate-backup-*** - Backup de archivos originales

## Rollback (Deshacer Cambios)

Si algo sale mal:

```bash
# Restaurar desde backup
cp .bun-migrate-backup-*/package-lock.json .
cp .bun-migrate-backup-*/Dockerfile.bak Dockerfile

# Eliminar archivos de Bun
rm -f bun.lock bun.lockb

# Reinstalar con npm
npm install
```

## Solución de Problemas

### Error: "bun: command not found"

Instala Bun primero:

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
irm bun.sh/install.ps1 | iex
```

### Error: "Cannot find module 'chalk'"

```bash
# Reinstala la herramienta
cd scripts/bun-migrate
npm install
npm link
```

### El Build Falla Después de la Migración

```bash
# Analiza el proyecto
bun-migrate analyze

# Si hay problemas, haz rollback
cp .bun-migrate-backup-*/package-lock.json .
npm install
```

## Ejemplos Reales

### Ejemplo 1: Migrar Proyecto Next.js

```bash
cd ~/projects/my-nextjs-app
bun-migrate migrate

# Resultado:
# - bun.lock creado
# - Dockerfile optimizado (Bun para build, Node.js para producción)
# - nixpacks.toml creado para Railway
# - Backup guardado en .bun-migrate-backup-*/
```

### Ejemplo 2: Migrar Proyecto React

```bash
cd ~/projects/my-react-app
bun-migrate migrate

# Resultado:
# - bun.lock creado
# - Dockerfile optimizado
# - nixpacks.toml creado
```

### Ejemplo 3: Solo Analizar (Sin Migrar)

```bash
cd ~/projects/my-app
bun-migrate analyze

# Resultado:
# - Diagnóstico de compatibilidad
# - Lista de advertencias
# - Sin cambios en archivos
```

## Comparativa de Rendimiento

| Operación | Antes (npm) | Después (Bun) | Mejora |
|-----------|-------------|---------------|---------|
| Instalación inicial | ~45s | ~4s | **11x más rápido** |
| Instalaciones subsiguientes | ~10s | ~1s | **10x más rápido** |
| Docker build | ~60s | ~45s | **1.3x más rápido** |
| Uso de memoria | 100% | 72% | **28% menos** |

## Consejos

1. **Siempre revisa los cambios** después de la migración
2. **Prueba el entorno de desarrollo** antes de deployar
3. **Usa Node.js en producción** (no Bun como runtime)
4. **Guarda el backup** hasta que estés seguro de que todo funciona
5. **Lee BUN_MIGRATION.md** para instrucciones específicas de tu proyecto

## Próximos Pasos

1. ✅ Migración completada con `bun-migrate migrate`
2. 📖 Lee `BUN_MIGRATION.md` creado en tu proyecto
3. 🧪 Prueba: `bun run dev`
4. 🏗️ Build: `bun run build`
5. 🚀 Deploy según instrucciones en `BUN_MIGRATION.md`

## Recursos

- [Documentación de Bun](https://bun.sh/docs)
- [Bun para Next.js](https://bun.sh/guides/ecosystem/nextjs)
- [Documentación de Nixpacks](https://nixpacks.com/docs)

---

**¿Necesitas ayuda?**

- Revisa el [README completo](./README.md)
- Abre un issue en GitHub
- Consulta la documentación de [Bun](https://bun.sh)
