# RAG: Logging Detallado y Corrección de Prefijos de Schema

## Fecha
6 de octubre de 2025

## Cambios Realizados

### 1. ✅ Logging Detallado Implementado

Se ha añadido logging comprehensivo en todos los endpoints de RAG para facilitar el debugging:

#### **Endpoint de Subida** (`app/api/rag/packages/[id]/documents/route.ts`)

**Logs añadidos:**
- 🔵 Inicio de subida con packageId y userId
- 🔵 Verificación de paquete (encontrado/no encontrado)
- 🔵 Archivos recibidos con contador
- 🔵 Procesamiento de cada archivo individual:
  - Inicio con filename, size, documentId
  - Extracción de texto exitosa con longitud
  - Generación de chunks con contador
  - Creación en BD
  - Almacenamiento en MinIO (éxito/fallo)
  - Indexación en Qdrant con count de vectores
  - Actualización de metadata
  - ✅ Éxito final por documento
- ⚠️ Warnings:
  - Sin archivos proporcionados
  - Sin contenido indexable
  - Sin chunks generados
  - Fallo de MinIO (no bloqueante)
  - Rollback de documento tras fallo
- ❌ Errores:
  - Paquete no encontrado
  - Fallo en rollback
- 📊 Resumen final:
  - Archivos procesados vs fallidos
  - Total de documentos en el paquete
  - Lista de archivos exitosos con chunks
  - Lista de archivos fallidos con errores

**Formato de logs:**
```
[RAG Upload] <acción> { detalles estructurados en JSON }
```

#### **Endpoint de Borrado** (`app/api/rag/packages/[id]/documents/[documentId]/route.ts`)

**Logs añadidos:**
- 🔵 Inicio de borrado con packageId, documentId, userId
- 🔵 Tipo de borrado (HARD/SOFT)
- 🔵 Paquete encontrado con nombre
- 🔵 Documento eliminado de BD con filename y pointCount
- 🔵 Intentos de eliminación en Qdrant:
  - ✅ Éxito por IDs con contador
  - ✅ Éxito por filtro (fallback)
  - ✅ Éxito por filtro sin IDs
- ⚠️ Warnings:
  - Acceso no autorizado
  - Permisos insuficientes
  - Fallos en eliminación de Qdrant
  - Completado con advertencia (vectores pueden permanecer)
- ❌ Errores:
  - Paquete no encontrado
  - Fallos en Qdrant
- 📊 Resumen final:
  - ✅ Éxito total (HARD/SOFT)
  - ⚠️ Éxito con advertencias

**Formato de logs:**
```
[RAG Delete] <acción> { detalles estructurados en JSON }
```

### 2. ✅ Corrección de Prefijos de Schema "projectnexus"

Se ha añadido el prefijo `projectnexus.` a **TODAS** las consultas SQL que hacen referencia a tablas RAG:

#### **Archivos Modificados:**

1. **lib/rag/store.ts** (Operaciones core de BD)
   - ✅ `SELECT COUNT(*) FROM projectnexus.rag_packages`
   - ✅ `INSERT INTO projectnexus.rag_packages`
   - ✅ `INSERT INTO projectnexus.rag_documents`
   - ✅ `SELECT ... FROM projectnexus.rag_packages`
   - ✅ `SELECT ... FROM projectnexus.rag_documents`
   - ✅ `UPDATE projectnexus.rag_packages SET ...`
   - ✅ `UPDATE projectnexus.rag_documents SET ...`
   - ✅ `DELETE FROM projectnexus.rag_documents`
   - ✅ `DELETE FROM projectnexus.rag_packages`

2. **app/api/rag/packages/[id]/documents/route.ts** (Subida)
   - ✅ `UPDATE projectnexus.rag_documents SET chunk_count ...`
   - ✅ `UPDATE projectnexus.rag_documents SET bucket ...`
   - ✅ `DELETE FROM projectnexus.rag_documents` (rollback)

3. **app/api/rag/packages/[id]/route.ts** (Gestión de paquetes)
   - ✅ `DELETE FROM projectnexus.rag_packages`
   - ✅ `UPDATE projectnexus.rag_packages SET deleted_at ...`

4. **app/api/rag/packages/[id]/restore/route.ts**
   - ✅ `UPDATE projectnexus.rag_packages SET deleted_at = NULL ...`

5. **app/api/rag/packages/[id]/ingest/route.ts**
   - ✅ `UPDATE projectnexus.rag_documents SET point_ids ...`

6. **app/api/rag/packages/[id]/documents/empty-trash/route.ts**
   - ✅ `SELECT ... FROM projectnexus.rag_documents`
   - ✅ `DELETE FROM projectnexus.rag_documents`
   - ✅ `UPDATE projectnexus.rag_packages SET updated_at ...`

7. **app/api/rag/packages/[id]/documents/deleted/route.ts**
   - ✅ `SELECT ... FROM projectnexus.rag_documents`

8. **app/api/rag/packages/[id]/documents/bulk/restore/route.ts**
   - ✅ `UPDATE projectnexus.rag_documents SET deleted_at = NULL ...`
   - ✅ `UPDATE projectnexus.rag_packages SET updated_at ...`

9. **app/api/rag/packages/[id]/documents/bulk/delete/route.ts**
   - ✅ `UPDATE projectnexus.rag_documents SET deleted_at ...`
   - ✅ `UPDATE projectnexus.rag_packages SET updated_at ...`
   - ✅ `SELECT ... FROM projectnexus.rag_documents`

10. **lib/billing/limits.ts**
    - ✅ `SELECT COUNT(*) FROM projectnexus.rag_packages`

11. **lib/authz.ts**
    - ✅ `SELECT rag_id FROM projectnexus.rag_team_assignments`
    - ✅ `SELECT rag_id FROM projectnexus.rag_user_assignments`

12. **scripts/check-documents.js**
    - ✅ `SELECT ... FROM projectnexus.rag_documents`

### 3. 🐛 Bug Arreglado en ingest/route.ts

Se corrigió una expresión regular rota:
```typescript
// Antes (roto):
const t = text.replace(/
/g, '\n');

// Después (correcto):
const t = text.replace(/\r\n/g, '\n');
```

## Diagnóstico del Problema Actual

### Síntomas
- ✅ API retorna 200 OK al subir `document_taxo_lyon.pdf`
- ❌ Documento NO aparece en la base de datos
- ❌ Documento NO aparece en la UI

### Verificación con Script
Ejecutado: `node scripts/check-documents.js`

**Resultado:**
```
📁 Documentos en el paquete (Total: 3):
1. _ Ticket _..pdf
2. Gmail - Urlaubsankündigung...pdf
3. Spanish_Coast_Itinerary.txt

❌ Documento "document_taxo_lyon.pdf" NO encontrado en la base de datos
```

### Hipótesis
El documento está siendo rechazado silenciosamente en alguno de los siguientes pasos:

1. **Validación de contenido** - Documento no contiene texto indexable
2. **Generación de chunks** - No se generan fragmentos de texto
3. **Error en procesamiento** - Capturado en el bloque catch pero no se loggea claramente

### Próximos Pasos para Debugging

1. **Subir nuevamente** `document_taxo_lyon.pdf` con el logging detallado activado
2. **Revisar logs** en la consola del servidor para ver exactamente dónde falla
3. **Verificar contenido** del PDF manualmente para asegurar que tiene texto
4. **Buscar en failures** array en la respuesta de la API

## Cómo Usar el Nuevo Logging

### Ver logs en desarrollo:
```bash
npm run dev
```

### Filtrar logs RAG:
```bash
# En PowerShell
npm run dev | Select-String "RAG Upload|RAG Delete"

# Ver solo errores
npm run dev | Select-String "❌|⚠️"

# Ver solo éxitos
npm run dev | Select-String "✅"
```

### Interpretar los logs:

**Subida exitosa:**
```
[RAG Upload] Starting document upload { packageId, userId }
[RAG Upload] Package found { packageName, teamSlug }
[RAG Upload] Files received { fileCount: 1 }
[RAG Upload] Processing file { filename, size }
[RAG Upload] Text extracted successfully { textLength: 45234 }
[RAG Upload] Chunks generated { chunkCount: 38 }
[RAG Upload] Document created in DB { documentId }
[RAG Upload] Vectors indexed in Qdrant { vectorCount: 38 }
[RAG Upload] ✅ Document processed successfully { filename }
[RAG Upload] Upload completed { processedCount: 1, failureCount: 0 }
```

**Subida con fallo:**
```
[RAG Upload] Processing file { filename, size }
[RAG Upload] Text extracted successfully { textLength: 45234 }
[RAG Upload] ⚠️ No chunks generated { filename }
[RAG Upload] Upload completed { processedCount: 0, failureCount: 1 }
[RAG Upload] ❌ Failed files: [{ filename, error }]
```

## Testing

### Para probar el logging:
1. Subir un PDF válido → Debe ver secuencia completa de logs ✅
2. Subir un archivo vacío → Debe ver warning de contenido ⚠️
3. Subir archivo corrupto → Debe ver error en catch ❌
4. Borrar documento → Debe ver logs de Qdrant ✅/⚠️

### Para verificar schema prefix:
```bash
node scripts/check-documents.js
```

Si funciona sin error "column deleted_at does not exist", el prefijo está correcto ✅

## Beneficios

### Antes:
- ❌ Errores silenciosos
- ❌ No se sabía en qué paso fallaba
- ❌ Schema prefix causaba errores ocultos
- ❌ Difícil debugging en producción

### Después:
- ✅ Logging detallado en cada paso
- ✅ Fácil identificar punto de fallo
- ✅ Schema prefix consistente
- ✅ Logs estructurados en JSON para parsing
- ✅ Emojis para identificación visual rápida
- ✅ Separación clara entre info/warning/error

## Comandos Útiles

```bash
# Verificar documentos en BD
node scripts/check-documents.js

# Ver estado de una tabla
psql $DATABASE_URL -c "SELECT COUNT(*) FROM projectnexus.rag_documents;"

# Ver últimos documentos subidos
psql $DATABASE_URL -c "SELECT filename, uploaded_at FROM projectnexus.rag_documents ORDER BY uploaded_at DESC LIMIT 5;"
```

## Notas Importantes

⚠️ **El prefijo `projectnexus.` es CRÍTICO** - Sin él, las consultas buscan en el schema `public` por defecto, donde no existen las tablas RAG.

⚠️ **Los logs usan formato estructurado JSON** - Facilita parsing automático para monitoring/alertas.

⚠️ **Los emojis en logs NO son decorativos** - Permiten filtrado visual rápido en consolas con mucho output.

## Estado Actual

✅ **Completado:**
- Logging detallado implementado
- Prefijos de schema añadidos
- Bug de regex arreglado
- Script de verificación funcional
- Problema diagnosticado completamente

🎯 **Diagnóstico Final:**
```
[RAG extract] ⚠️ PDF has no extractable text
diagnosis: 'PDF probablemente es escaneado (solo imágenes) o está protegido. Necesita OCR para indexar.'

[RAG Upload] ❌ Failed files: [
  {
    filename: 'document_taxo_lyon.pdf',
    error: 'PDF no contiene texto extraíble. Puede ser un archivo escaneado (solo imágenes) 
            o protegido. Se requiere OCR para indexar este tipo de archivos.'
  }
]
```

**Conclusión:** `document_taxo_lyon.pdf` es un PDF escaneado (solo imágenes). No tiene capa de texto seleccionable. El sistema funciona correctamente rechazando archivos sin contenido indexable.

� **Documentación Creada:**
- `docs/rag/logging-and-schema-fixes.md` - Este documento
- `docs/rag/scanned-pdfs.md` - Guía completa sobre PDFs escaneados y soluciones OCR

🔧 **Solución para el Usuario:**
Ver `docs/rag/scanned-pdfs.md` para instrucciones sobre cómo aplicar OCR al PDF antes de subirlo.
