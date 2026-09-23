#!/bin/bash

echo "🚀 Instalando nuevas dependencias para ProjectNexus RAG..."
echo ""

echo "📦 Instalando librerías para Excel y PowerPoint..."
npm install xlsx adm-zip

echo ""
echo "📝 Instalando tipos de TypeScript..."
npm install --save-dev @types/adm-zip

echo ""
echo "✅ ¡Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Reiniciar el servidor: npm run dev"
echo "2. Probar subiendo archivos Excel (.xlsx) o PowerPoint (.pptx)"
echo "3. Ver la documentación en: docs/RAG-IMPROVEMENTS.md"
echo ""
echo "💡 Características nuevas disponibles:"
echo "   ✨ Streaming de respuestas en tiempo real"
echo "   🧠 Chunking semántico inteligente"
echo "   📄 Soporte para Excel y PowerPoint"
echo "   📚 Sistema de citación de fuentes"
echo "   💬 Historial de contexto en conversaciones"
echo ""
