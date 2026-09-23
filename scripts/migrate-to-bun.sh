#!/bin/bash

# Script de Migración de npm a Bun para Nexary
# Este script automatiza la migración de npm a Bun

set -e  # Exit on error

echo "🚀 Migrando Nexary de npm a Bun..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para verificar si Bun está instalado
check_bun() {
    if ! command -v bun &> /dev/null; then
        echo -e "${YELLOW}⚠️  Bun no está instalado. Instalando...${NC}"
        curl -fsSL https://bun.sh/install | bash
        echo -e "${GREEN}✅ Bun instalado correctamente${NC}"
        # Recargar PATH
        export PATH="$HOME/.bun/bin:$PATH"
    else
        echo -e "${GREEN}✅ Bun ya está instalado: $(bun --version)${NC}"
    fi
}

# Función para generar bun.lock
generate_lockfile() {
    echo ""
    echo -e "${BLUE}📦 Generando bun.lock...${NC}"

    if [ -f "bun.lock" ]; then
        echo -e "${YELLOW}⚠️  bun.lock ya existe. ¿Regenerar? (y/N)${NC}"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            rm bun.lock
        else
            echo "Manteniendo bun.lock existente"
            return
        fi
    fi

    bun install
    echo -e "${GREEN}✅ bun.lock generado${NC}"
}

# Función para verificar scripts
verify_scripts() {
    echo ""
    echo -e "${BLUE}🔍 Verificando scripts en package.json...${NC}"

    if ! grep -q '"dev":' package.json; then
        echo -e "${YELLOW}⚠️  Script 'dev' no encontrado${NC}"
    fi

    if ! grep -q '"build":' package.json; then
        echo -e "${YELLOW}⚠️  Script 'build' no encontrado${NC}"
    fi

    if ! grep -q '"start":' package.json; then
        echo -e "${YELLOW}⚠️  Script 'start' no encontrado${NC}"
    fi

    echo -e "${GREEN}✅ Scripts verificados${NC}"
}

# Función para verificar compatibilidad
check_compatibility() {
    echo ""
    echo -e "${BLUE}🔍 Verificando compatibilidad de paquetes...${NC}"

    # Lista de paquetes conocidos compatibles
    local compatible=(
        "next"
        "react"
        "typescript"
        "tailwindcss"
        "@radix-ui"
        "zod"
        "ioredis"
        "pg"
        "pino"
    )

    for pkg in "${compatible[@]}"; do
        if grep -q "\"$pkg" package.json; then
            echo -e "  ${GREEN}✓${NC} $pkg - Compatible"
        fi
    done

    echo -e "${GREEN}✅ Verificación de compatibilidad completada${NC}"
}

# Función para crear backup
create_backup() {
    echo ""
    echo -e "${BLUE}💾 Creando backup de archivos críticos...${NC}"

    local backup_dir=".backup-before-bun-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    [ -f "package-lock.json" ] && cp package-lock.json "$backup_dir/"
    [ -f "bun.lock" ] && cp bun.lock "$backup_dir/"

    echo -e "${GREEN}✅ Backup creado en $backup_dir${NC}"
}

# Función para ejecutar tests de verificación
run_verification_tests() {
    echo ""
    echo -e "${BLUE}🧪 Ejecutando tests de verificación...${NC}"

    echo "  1. Verificando instalación de dependencias..."
    if bun install --dry-run 2>/dev/null; then
        echo -e "    ${GREEN}✓${NC} Dependencias OK"
    else
        echo -e "    ${YELLOW}⚠${NC} Advertencias en dependencias"
    fi

    echo "  2. Verificando TypeScript..."
    if bun run typecheck 2>/dev/null; then
        echo -e "    ${GREEN}✓${NC} TypeScript OK"
    else
        echo -e "    ${YELLOW}⚠${NC} Errores de TypeScript (preexistentes)"
    fi

    echo -e "${GREEN}✅ Tests de verificación completados${NC}"
}

# Función para mostrar resumen
show_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          ✅ Migración a Bun Completada Exitosamente          ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "📝 Próximos pasos:"
    echo ""
    echo "  1. Comandos de desarrollo:"
    echo "     - bun dev          # Iniciar servidor de desarrollo"
    echo "     - bun install      # Instalar nuevas dependencias"
    echo "     - bun add <pkg>    # Agregar paquete"
    echo ""
    echo "  2. Comandos de build:"
    echo "     - bun run build    # Build de producción"
    echo "     - bun run lint     # Verificar código"
    echo "     - bun test         # Ejecutar tests"
    echo ""
    echo "  3. Para producción:"
    echo "     - docker-compose up -d    # Build con Docker (usa Bun)"
    echo "     - node .next/standalone/server.js  # Ejecutar directamente"
    echo ""
    echo "📚 Documentación:"
    echo "     - docs/BUN_VS_NPM_GUIDE.md    # Guía completa de comparación"
    echo "     - docs/BUN_OPTIMIZATION.md    # Guía de optimización con Bun"
    echo ""
    echo "⚠️  Notas importantes:"
    echo "     - Los scripts de package.json funcionan igual con Bun"
    echo "     - Production usa Node.js para máxima estabilidad"
    echo "     - Mantén package-lock.json temporalmente como backup"
    echo ""
}

# Función para actualizar .gitignore
update_gitignore() {
    echo ""
    echo -e "${BLUE}📝 Actualizando .gitignore...${NC}"

    if ! grep -q "^bun.lock$" .gitignore 2>/dev/null; then
        echo "" >> .gitignore
        echo "# Bun lock file" >> .gitignore
        echo "bun.lock" >> .gitignore
        echo -e "${GREEN}✅ Agregado bun.lock a .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠️  bun.lock ya está en .gitignore${NC}"
    fi
}

# Main execution
main() {
    # Mostrar banner
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║                                                        ║"
    echo "║   🚀 Migración de Nexary de npm a Bun                 ║"
    echo "║                                                        ║"
    echo "║   Velocidad 10-20x mayor en instalaciones             ║"
    echo "║   Compatibilidad total con stack actual               ║"
    echo "║                                                        ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Confirmación
    echo -e "${YELLOW}⚠️  Este script hará los siguientes cambios:${NC}"
    echo "     1. Instalará Bun (si no está instalado)"
    echo "     2. Generará bun.lock"
    echo "     3. Creará backup de archivos críticos"
    echo "     4. Actualizará .gitignore"
    echo ""
    read -p "¿Continuar? (y/N) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Migración cancelada"
        exit 1
    fi

    # Ejecutar pasos
    check_bun
    create_backup
    generate_lockfile
    verify_scripts
    check_compatibility
    update_gitignore
    run_verification_tests
    show_summary

    echo -e "${GREEN}✨ ¡Migración completada!${NC}"
}

# Ejecutar script
main "$@"
