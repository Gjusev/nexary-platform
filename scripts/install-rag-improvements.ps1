# Script de instalación para Windows (PowerShell)

Write-Host "🚀 Instalando nuevas dependencias para ProjectNexus RAG..." -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 Instalando librerías para Excel y PowerPoint..." -ForegroundColor Yellow
npm install xlsx adm-zip

Write-Host ""
Write-Host "📝 Instalando tipos de TypeScript..." -ForegroundColor Yellow
npm install --save-dev @types/adm-zip

Write-Host ""
Write-Host "✅ ¡Instalación completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Reiniciar el servidor: npm run dev"
Write-Host "2. Probar subiendo archivos Excel (.xlsx) o PowerPoint (.pptx)"
Write-Host "3. Ver la documentación en: docs\RAG-IMPROVEMENTS.md"
Write-Host ""
Write-Host "💡 Características nuevas disponibles:" -ForegroundColor Magenta
Write-Host "   ✨ Streaming de respuestas en tiempo real"
Write-Host "   🧠 Chunking semántico inteligente"
Write-Host "   📄 Soporte para Excel y PowerPoint"
Write-Host "   📚 Sistema de citación de fuentes"
Write-Host "   💬 Historial de contexto en conversaciones"
Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
