# Configuración del Sistema RAG - Sin MinIO

## Estado Actual de tu Configuración

✅ **Variables Configuradas Correctamente:**
- `QDRANT_URL` - Configurado
- `QDRANT_API_KEY` - Configurado
- `OPENAI_API_KEY` - Configurado
- `OPENAI_EMBEDDING_MODEL` - Configurado (text-embedding-3-small)

❌ **Variables No Configuradas (OPCIONAL):**
- `MINIO_ENDPOINT` - No configurado
- `MINIO_ACCESS_KEY` - No configurado
- `MINIO_SECRET_KEY` - No configurado
- `TEXT_EXTRACTOR_URL` - No configurado

## ¿Cómo Funciona Sin MinIO?

### Flujo Normal (Con MinIO)
```
Usuario sube documento
    ↓
Extraer texto
    ↓
Crear documento en BD
    ↓
Guardar archivo original en MinIO ← Paso opcional
    ↓
Crear vectores con OpenAI
    ↓
Almacenar vectores en Qdrant
```

### Flujo Sin MinIO (Tu Configuración Actual)
```
Usuario sube documento
    ↓
Extraer texto
    ↓
Crear documento en BD
    ↓
[SKIP] MinIO no configurado - continuar
    ↓
Crear vectores con OpenAI
    ↓
Almacenar vectores en Qdrant
```

## ¿Qué Pasa Sin MinIO?

### ✅ **Funciona Normalmente:**
- Subida de documentos
- Extracción de texto
- Generación de embeddings
- Almacenamiento de vectores en Qdrant
- Búsquedas en documentos
- Borrado de documentos

### ❌ **NO Disponible:**
- Descarga del archivo original
- Backup de archivos fuente
- Re-procesamiento de documentos sin re-subir

## Almacenamiento de Datos

### Con tu configuración actual:

| Dato | Dónde se almacena |
|------|-------------------|
| Metadata del documento (nombre, tipo, fecha) | PostgreSQL |
| Texto extraído (en chunks) | Qdrant (como payload) |
| Vectores de embeddings | Qdrant |
| Archivo original | ❌ No se guarda |

### Con MinIO configurado:

| Dato | Dónde se almacena |
|------|-------------------|
| Metadata del documento | PostgreSQL |
| Texto extraído | Qdrant (como payload) |
| Vectores de embeddings | Qdrant |
| Archivo original | ✅ MinIO |

## Código que Maneja MinIO Opcional

### En `app/api/rag/packages/[id]/documents/route.ts`:

```typescript
// PASO 3: Persistir archivo original en MinIO (opcional)
try {
  const arrayBuf = await (f as File).arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  const bucket = process.env.MINIO_BUCKET || 'projectnexus';
  const safeName = f.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const objectKey = `team/${pkg.teamSlug}/packages/${packageId}/docs/${id}-${safeName}`;
  await putObjectBuffer(bucket, objectKey, buf, f.type || 'application/octet-stream');
  await dbQuery(`UPDATE rag_documents SET bucket=$1, object_key=$2 WHERE id=$3`, [bucket, objectKey, id]);
} catch (minioError) {
  console.warn(`MinIO storage failed for ${f.name}, continuing without backup:`, minioError);
  // ← Esto NO bloquea la subida, solo loguea un warning
}
```

### En `lib/storage/minio.ts`:

```typescript
export async function getMinioClient(): Promise<MinioClient | null> {
  try {
    const Minio = require('minio');
    const endPoint = process.env.MINIO_ENDPOINT;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    if (!endPoint || !accessKey || !secretKey) return null; // ← Devuelve null sin error
    // ...
  } catch {
    return null; // ← Devuelve null si hay error
  }
}
```

## Verificación de tu Sistema

Para verificar que todo funciona sin MinIO:

```bash
# 1. Verifica que el servidor arranca sin errores de MinIO
npm run dev

# Deberías ver en los logs (si el validador está activo):
# ⚠️  Advertencias:
#   - MinIO: opcional (no configurado)

# 2. Prueba subir un documento
# - Ve a /dashboard/rag
# - Crea un paquete
# - Sube un archivo TXT o PDF

# 3. Verifica los logs del servidor
# Deberías ver:
# ✓ Documento procesado correctamente
# ⚠ MinIO storage failed, continuing without backup
```

## ¿Cuándo Necesitas MinIO?

### **NO necesitas MinIO si:**
- Solo usas RAG para búsquedas semánticas
- No necesitas descargar archivos originales
- No necesitas re-procesar documentos
- El texto extraído en Qdrant es suficiente

### **SÍ necesitas MinIO si:**
- Quieres ofrecer descarga de documentos originales
- Necesitas backup de archivos fuente
- Planeas re-procesar documentos con diferentes chunking
- Necesitas auditoría de archivos originales

## Configurar MinIO (Si lo Necesitas en el Futuro)

### Opción 1: MinIO Local (Docker)

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

Luego añade a `.env.local`:
```bash
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=projectnexus
```

### Opción 2: MinIO en la Nube

Servicios compatibles con S3:
- AWS S3
- DigitalOcean Spaces
- Cloudflare R2
- Backblaze B2

## Resumen

✅ **Tu sistema RAG funciona perfectamente SIN MinIO**

**Características disponibles:**
- ✅ Subida de documentos
- ✅ Extracción de texto
- ✅ Generación de embeddings
- ✅ Búsquedas semánticas
- ✅ Borrado de documentos
- ✅ Gestión de paquetes RAG

**Características NO disponibles:**
- ❌ Descarga de archivos originales
- ❌ Backup de documentos fuente

**Recomendación**: Usa tu sistema actual sin MinIO. Solo configúralo si necesitas las características adicionales.

---

**Nota**: Si ves warnings sobre MinIO en los logs, son normales y no afectan la funcionalidad.
