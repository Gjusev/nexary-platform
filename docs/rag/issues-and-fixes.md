# Problemas y Soluciones del Sistema RAG

## Fecha: 6 de Octubre 2025

## Resumen de Problemas Identificados

### 1. **Problemas de Subida de Documentos**

#### Problema 1.1: Manejo inconsistente de errores en la extracción de texto
- **Ubicación**: `app/api/rag/packages/[id]/documents/route.ts`
- **Descripción**: La extracción de texto falla silenciosamente en algunos casos, creando documentos sin contenido indexable
- **Impacto**: Los documentos se marcan como subidos pero no se pueden buscar

#### Problema 1.2: Falta de validación de tipos de archivo antes del procesamiento
- **Ubicación**: `app/dashboard/rag/page.tsx` (UploadDocumentDialog)
- **Descripción**: La validación del lado del cliente es débil y permite archivos no soportados
- **Impacto**: Usuarios esperan que archivos suban correctamente cuando no son soportados

#### Problema 1.3: Configuración de MinIO no validada
- **Ubicación**: `lib/storage/minio.ts`
- **Descripción**: Si MinIO no está configurado, los errores no se comunican claramente al usuario
- **Impacto**: Confusión sobre por qué las subidas fallan

### 2. **Problemas de Borrado de Documentos**

#### Problema 2.1: Borrado soft no sincroniza correctamente con Qdrant
- **Ubicación**: `lib/rag/store.ts` (removeDocument)
- **Descripción**: Cuando se hace soft delete, los puntos en Qdrant no se marcan o eliminan
- **Impacto**: Los documentos "borrados" siguen apareciendo en búsquedas

#### Problema 2.2: Borrado hard puede fallar parcialmente
- **Ubicación**: `app/api/rag/packages/[id]/documents/[documentId]/route.ts`
- **Descripción**: Si falla el borrado en Qdrant, el documento ya está eliminado de la BD
- **Impacto**: Estado inconsistente entre BD y Qdrant

#### Problema 2.3: La papelera no actualiza el estado del paquete correctamente
- **Ubicación**: `app/dashboard/rag/page.tsx`
- **Descripción**: Después de restaurar/borrar desde la papelera, los contadores no se actualizan
- **Impacto**: UI muestra información incorrecta

### 3. **Problemas de Configuración y Variables de Entorno**

#### Problema 3.1: Variables de entorno opcionales no documentadas
- **Variables requeridas pero no verificadas**:
  - `QDRANT_URL`
  - `QDRANT_API_KEY`
  - `QDRANT_VECTOR_SIZE` (default: 1536)
  - `QDRANT_DISTANCE` (default: Cosine)
  - `MINIO_ENDPOINT` (opcional)
  - `MINIO_ACCESS_KEY` (opcional)
  - `MINIO_SECRET_KEY` (opcional)
  - `TEXT_EXTRACTOR_URL` (opcional)

### 4. **Problemas de Sincronización de Estado**

#### Problema 4.1: Estado del frontend no se actualiza después de operaciones
- **Ubicación**: `app/dashboard/rag/page.tsx`
- **Descripción**: Varios handlers no actualizan todos los estados necesarios
- **Impacto**: La UI puede mostrar información desactualizada

#### Problema 4.2: Carga de la papelera no maneja errores de red
- **Ubicación**: `app/dashboard/rag/page.tsx` (toggleDocTrash)
- **Descripción**: Si falla la carga de documentos borrados, el estado queda inconsistente
- **Impacto**: La papelera puede aparecer vacía cuando tiene elementos

---

## Soluciones Propuestas

### Solución 1: Mejorar manejo de errores en subida de documentos

**Cambios en**: `app/api/rag/packages/[id]/documents/route.ts`

```typescript
// Mejorar validación previa
// Añadir try-catch más específicos
// Rollback de documento si falla la indexación
// Mejorar mensajes de error al usuario
```

### Solución 2: Sincronizar operaciones de borrado con transacciones

**Cambios en**: `lib/rag/store.ts` y APIs relacionadas

```typescript
// Implementar patrón de dos fases:
// 1. Marcar en BD
// 2. Eliminar en Qdrant
// 3. Si falla Qdrant, hacer rollback en BD
```

### Solución 3: Validación de configuración al inicio

**Nuevo archivo**: `lib/rag/config-validator.ts`

```typescript
// Verificar todas las variables de entorno necesarias
// Mostrar warnings claros en logs
// Deshabilitar features que requieran servicios no configurados
```

### Solución 4: Mejorar actualización de estado en el frontend

**Cambios en**: `app/dashboard/rag/page.tsx`

```typescript
// Refrescar lista completa después de operaciones críticas
// Manejar estados de carga/error más granularmente
// Implementar reintentos automáticos para operaciones de red
```

---

## Plan de Implementación

### Fase 1: Fixes Críticos (Prioridad Alta)
1. ✅ Documentar problemas actuales
2. ⬜ Mejorar manejo de errores en subida
3. ⬜ Sincronizar borrado entre BD y Qdrant
4. ⬜ Validar configuración al inicio

### Fase 2: Mejoras de UX (Prioridad Media)
1. ⬜ Mejorar mensajes de error al usuario
2. ⬜ Añadir indicadores de progreso más detallados
3. ⬜ Implementar reintentos automáticos
4. ⬜ Mejorar validación de archivos en el cliente

### Fase 3: Optimizaciones (Prioridad Baja)
1. ⬜ Cachear resultados de consultas frecuentes
2. ⬜ Implementar subida por chunks para archivos grandes
3. ⬜ Añadir tests automatizados
4. ⬜ Monitoreo y alertas de errores

---

## Problemas Específicos Encontrados en el Código

### 1. En `app/api/rag/packages/[id]/documents/route.ts`

**Líneas 171-176**: El documento se añade a la BD antes de verificar si se puede extraer texto
```typescript
await appendDocument(packageId, doc as any); // ← Se añade antes de saber si funcionará
```
**Solución**: Extraer y validar el texto ANTES de appendDocument

### 2. En `lib/rag/store.ts`

**Línea 284**: El soft delete no elimina puntos de Qdrant
```typescript
await query('UPDATE rag_documents SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND package_id = $3', [userId || '', documentId, packageId]);
// ← No hay llamada a deletePoints de Qdrant
```
**Solución**: Añadir parámetro para eliminar de Qdrant en soft delete o marcar puntos

### 3. En `app/dashboard/rag/page.tsx`

**Líneas 138-168**: handleRemoveStoredDocument no actualiza contadores del paquete
```typescript
setPackages((prev: RagPackageSummary[]) => prev.map((pkg: RagPackageSummary) => (pkg.id === packageId ? data.package! : pkg)));
```
**Problema**: Esto funciona si `data.package` tiene los contadores correctos, pero no hay garantía

### 4. En `app/api/rag/packages/[id]/documents/[documentId]/route.ts`

**Líneas 71-95**: Triple intento de borrado de puntos es bueno, pero no se loguea adecuadamente
```typescript
try {
  await deletePoints(updatedPackage.collectionName, pointIds);
} catch (pointError) {
  console.error('Failed to delete points from Qdrant by ids', pointError);
  // ← Usuario no sabe que falló parcialmente
```

---

## Checklist de Variables de Entorno Necesarias

Crear archivo `.env.example`:

```bash
# Qdrant (REQUERIDO para RAG)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key-here
QDRANT_VECTOR_SIZE=1536
QDRANT_DISTANCE=Cosine

# MinIO (OPCIONAL - para almacenar archivos originales)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=projectnexus

# Text Extractor (OPCIONAL - para PDFs y DOCs complejos)
TEXT_EXTRACTOR_URL=http://localhost:8080/extract

# OpenAI (REQUERIDO para embeddings)
OPENAI_API_KEY=sk-...
```

---

## Próximos Pasos Recomendados

1. **Inmediato**: Crear validador de configuración
2. **Corto plazo**: Implementar transacciones para operaciones de borrado
3. **Medio plazo**: Refactorizar manejo de errores en subida
4. **Largo plazo**: Añadir tests automatizados para flujos RAG

---

## Notas Adicionales

- El código usa tanto Stack Auth (nuevo) como NextAuth (legacy) - verificar migración completa
- Algunos mensajes están en alemán (Deutsch) mezclados con español - normalizar idioma
- La estructura de roles está bien implementada pero compleja - documentar flujos de autorización
