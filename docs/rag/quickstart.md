# Guía Rápida: Correcciones del Sistema RAG

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

Copia las variables necesarias a tu archivo `.env`:

```bash
# Mínimo requerido para RAG
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=tu-clave-aqui
OPENAI_API_KEY=sk-tu-clave-aqui
```

### 2. Verificar Configuración

El sistema ahora valida automáticamente la configuración al iniciar. Verás un mensaje como este:

```
🚀 Initializing RAG System...

=== RAG Configuration Status ===
Valid: ✅

Features:
  Qdrant: ✅
  Embeddings: ✅
  MinIO: ⚠️  (opcional)
  Text Extractor: ⚠️  (opcional)

✅ RAG System initialized successfully
```

Si hay errores, aparecerán claramente:

```
❌ Errores:
  - QDRANT_URL no está configurado - RAG no funcionará
  - OPENAI_API_KEY no está configurado - no se pueden generar embeddings
```

### 3. Usar el Sistema RAG

#### Subir Documentos

1. Ve a `/dashboard/rag`
2. Crea un paquete RAG
3. Sube documentos (PDF, TXT, MD, JSON, DOC, DOCX)

**Mejoras**:
- ✅ Validación antes de crear en BD
- ✅ Rollback automático si falla
- ✅ Mensajes claros de error

#### Eliminar Documentos

**Soft Delete** (mover a papelera):
- Click en el icono de papelera del documento
- Se elimina de la lista y de Qdrant
- Permanece en la papelera para restauración

**Hard Delete** (borrado permanente):
- Abrir papelera del paquete
- Click en "Eliminar" del documento
- Se elimina permanentemente de BD y Qdrant

**Mejoras**:
- ✅ Sincronización con Qdrant
- ✅ Triple estrategia de borrado
- ✅ Warnings si Qdrant falla

## 🔍 Características Opcionales

### MinIO (Almacenamiento de Archivos)

Si quieres guardar los archivos originales:

```bash
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=projectnexus
```

**Sin MinIO**: Los documentos se almacenan solo como vectores en Qdrant.

### Text Extractor (PDFs Complejos)

Para PDFs con imágenes o formatos complejos:

```bash
TEXT_EXTRACTOR_URL=http://localhost:8080/extract
```

**Sin Text Extractor**: Usa parser interno (funciona para mayoría de PDFs simples).

## 🐛 Problemas Corregidos

### ✅ Documentos sin contenido
**Antes**: Se creaban documentos vacíos en BD  
**Ahora**: Se valida contenido antes de crear

### ✅ Documentos eliminados en búsquedas
**Antes**: Soft delete no eliminaba vectores  
**Ahora**: Soft delete también elimina de Qdrant

### ✅ Errores silenciosos
**Antes**: Fallos no se comunicaban al usuario  
**Ahora**: Mensajes claros y warnings

### ✅ Estado inconsistente
**Antes**: BD y Qdrant podían desincronizarse  
**Ahora**: Triple estrategia + warnings

## 📚 Documentación Completa

- **Análisis de problemas**: `docs/rag/issues-and-fixes.md`
- **Resumen de cambios**: `docs/rag/fixes-summary.md`
- **Variables de entorno**: `.env.example`

## 🆘 Soporte

Si encuentras problemas:

1. Verifica la configuración con los logs de inicio
2. Revisa `docs/rag/issues-and-fixes.md`
3. Busca en los logs del servidor mensajes de error detallados
4. Los warnings en la UI indican problemas no críticos

## 🎯 Testing Recomendado

1. ✅ Subir archivo TXT simple
2. ✅ Subir archivo PDF
3. ✅ Mover documento a papelera
4. ✅ Restaurar documento
5. ✅ Eliminar documento permanentemente
6. ✅ Verificar logs para warnings

---

**Última actualización**: 6 de Octubre 2025
