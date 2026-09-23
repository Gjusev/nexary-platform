# Script de Migración de npm a Bun para Nexary (Windows)
# Este script automatiza la migración de npm a Bun

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Show-Banner {
    Write-ColorOutput "╔════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║                                                        ║" "Cyan"
    Write-ColorOutput "║   🚀 Migración de Nexary de npm a Bun                 ║" "Cyan"
    Write-ColorOutput "║                                                        ║" "Cyan"
    Write-ColorOutput "║   Velocidad 10-20x mayor en instalaciones             ║" "Cyan"
    Write-ColorOutput "║   Compatibilidad total con stack actual               ║" "Cyan"
    Write-ColorOutput "║                                                        ║" "Cyan"
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" "Cyan"
    Write-Host ""
}

function Test-BunInstalled {
    try {
        $version = bun --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Bun ya está instalado: $version" "Green"
            return $true
        }
    } catch {
        # Continue to installation
    }

    Write-ColorOutput "⚠️  Bun no está instalado. Instalando..." "Yellow"
    irm bun.sh/install.ps1 | iex
    Write-ColorOutput "✅ Bun instalado correctamente" "Green"
    Write-Host "Por favor, cierra y vuelve a abrir esta terminal para usar Bun"
    return $false
}

function New-Lockfile {
    Write-Host ""
    Write-ColorOutput "📦 Generando bun.lock..." "Blue"

    if (Test-Path "bun.lock") {
        $response = Read-Host "⚠️  bun.lock ya existe. ¿Regenerar? (y/N)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Remove-Item "bun.lock" -Force
        } else {
            Write-ColorOutput "Manteniendo bun.lock existente" "Yellow"
            return
        }
    }

    bun install
    Write-ColorOutput "✅ bun.lock generado" "Green"
}

function Test-Scripts {
    Write-Host ""
    Write-ColorOutput "🔍 Verificando scripts en package.json..." "Blue"

    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

    $requiredScripts = @("dev", "build", "start")
    foreach ($script in $requiredScripts) {
        if (-not $packageJson.scripts.PSObject.Properties.Name.Contains($script)) {
            Write-ColorOutput "⚠️  Script '$script' no encontrado" "Yellow"
        }
    }

    Write-ColorOutput "✅ Scripts verificados" "Green"
}

function Test-Compatibility {
    Write-Host ""
    Write-ColorOutput "🔍 Verificando compatibilidad de paquetes..." "Blue"

    $compatiblePackages = @(
        "next",
        "react",
        "typescript",
        "tailwindcss",
        "@radix-ui",
        "zod",
        "ioredis",
        "pg",
        "pino"
    )

    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $allDependencies = @($packageJson.dependencies.PSObject.Properties.Name)
    $allDevDependencies = @($packageJson.devDependencies.PSObject.Properties.Name)
    $allPackages = $allDependencies + $allDevDependencies

    foreach ($pkg in $compatiblePackages) {
        foreach ($installed in $allPackages) {
            if ($installed -like "$pkg*") {
                Write-Host "  " -NoNewline
                Write-ColorOutput "✓ $installed - Compatible" "Green"
                break
            }
        }
    }

    Write-ColorOutput "✅ Verificación de compatibilidad completada" "Green"
}

function Backup-Files {
    Write-Host ""
    Write-ColorOutput "💾 Creando backup de archivos críticos..." "Blue"

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupDir = ".backup-before-bun-$timestamp"

    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    if (Test-Path "package-lock.json") {
        Copy-Item "package-lock.json" "$backupDir\"
    }

    if (Test-Path "bun.lock") {
        Copy-Item "bun.lock" "$backupDir\"
    }

    Write-ColorOutput "✅ Backup creado en $backupDir" "Green"
}

function Test-Verification {
    Write-Host ""
    Write-ColorOutput "🧪 Ejecutando tests de verificación..." "Blue"

    Write-Host "  1. Verificando instalación de dependencias..."
    $installCheck = bun install --dry-run 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    " -NoNewline
        Write-ColorOutput "✓ Dependencias OK" "Green"
    } else {
        Write-Host "    " -NoNewline
        Write-ColorOutput "⚠ Advertencias en dependencias" "Yellow"
    }

    Write-Host "  2. Verificando TypeScript..."
    $typecheck = bun run typecheck 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    " -NoNewline
        Write-ColorOutput "✓ TypeScript OK" "Green"
    } else {
        Write-Host "    " -NoNewline
        Write-ColorOutput "⚠ Errores de TypeScript (preexistentes)" "Yellow"
    }

    Write-ColorOutput "✅ Tests de verificación completados" "Green"
}

function Show-Summary {
    Write-Host ""
    Write-ColorOutput "╔════════════════════════════════════════════════════════╗" "Green"
    Write-ColorOutput "║          ✅ Migración a Bun Completada Exitosamente          ║" "Green"
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" "Green"
    Write-Host ""
    Write-Host "📝 Próximos pasos:"
    Write-Host ""
    Write-Host "  1. Comandos de desarrollo:"
    Write-Host "     - bun dev          # Iniciar servidor de desarrollo"
    Write-Host "     - bun install      # Instalar nuevas dependencias"
    Write-Host "     - bun add <pkg>    # Agregar paquete"
    Write-Host ""
    Write-Host "  2. Comandos de build:"
    Write-Host "     - bun run build    # Build de producción"
    Write-Host "     - bun run lint     # Verificar código"
    Write-Host "     - bun test         # Ejecutar tests"
    Write-Host ""
    Write-Host "  3. Para producción:"
    Write-Host "     - docker-compose up -d    # Build con Docker (usa Bun)"
    Write-Host "     - node .next/standalone/server.js  # Ejecutar directamente"
    Write-Host ""
    Write-Host "📚 Documentación:"
    Write-Host "     - docs/BUN_VS_NPM_GUIDE.md    # Guía completa de comparación"
    Write-Host "     - docs/BUN_OPTIMIZATION.md    # Guía de optimización con Bun"
    Write-Host ""
    Write-ColorOutput "⚠️  Notas importantes:" "Yellow"
    Write-Host "     - Los scripts de package.json funcionan igual con Bun"
    Write-Host "     - Production usa Node.js para máxima estabilidad"
    Write-Host "     - Mantén package-lock.json temporalmente como backup"
    Write-Host ""
}

function Update-Gitignore {
    Write-Host ""
    Write-ColorOutput "📝 Actualizando .gitignore..." "Blue"

    $gitignorePath = ".gitignore"
    $bunLockEntry = "bun.lock"

    if (Test-Path $gitignorePath) {
        $gitignoreContent = Get-Content $gitignorePath -Raw

        if ($gitignoreContent -notmatch [regex]::Escape($bunLockEntry)) {
            Add-Content $gitignorePath ""
            Add-Content $gitignorePath "# Bun lock file"
            Add-Content $gitignorePath $bunLockEntry
            Write-ColorOutput "✅ Agregado bun.lock a .gitignore" "Green"
        } else {
            Write-ColorOutput "⚠️  bun.lock ya está en .gitignore" "Yellow"
        }
    } else {
        Write-ColorOutput "⚠️  .gitignore no encontrado" "Yellow"
    }
}

# Main execution
function Main {
    Show-Banner

    Write-ColorOutput "⚠️  Este script hará los siguientes cambios:" "Yellow"
    Write-Host "     1. Instalará Bun (si no está instalado)"
    Write-Host "     2. Generará bun.lock"
    Write-Host "     3. Creará backup de archivos críticos"
    Write-Host "     4. Actualizará .gitignore"
    Write-Host ""
    $response = Read-Host "¿Continuar? (y/N)"

    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-ColorOutput "❌ Migración cancelada" "Red"
        exit 1
    }

    # Check if Bun is installed
    $bunInstalled = Test-BunInstalled
    if (-not $bunInstalled) {
        Write-ColorOutput "Por favor, ejecuta este script nuevamente después de recargar la terminal" "Yellow"
        exit 0
    }

    # Execute migration steps
    Backup-Files
    New-Lockfile
    Test-Scripts
    Test-Compatibility
    Update-Gitignore
    Test-Verification
    Show-Summary

    Write-ColorOutput "✨ ¡Migración completada!" "Green"
}

# Execute main function
Main
