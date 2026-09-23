import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { getPackageById, appendDocument } from '@/lib/rag/store';
import { ensureCollection, upsertPoints } from '@/lib/rag/qdrant';
import { embedTexts } from '@/lib/rag/query-pipeline';
import { putObjectBuffer } from '@/lib/storage/minio';
import { query as dbQuery } from '@/lib/db';
import { extractTextFromBuffer } from '@/lib/rag/text-extract';
import { allowedRagIds } from '@/lib/authz';
import { getStackServerAppFromCookies, collectUserRoles, findTeamForSlug } from '@/lib/rag/auth-helpers';
import { checkAndIncrementUsage } from '@/lib/billing/limits';
import { smartChunkText } from '@/lib/rag/smart-chunking';
import {
  createMasterDocument,
  assignDocumentToRags,
  updateAssignmentStatus,
} from '@/lib/rag/master-document-store';
import { checkRagRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = getStackServerAppFromCookies();

function estimateChunks(sizeBytes: number): number {
  // Conservative chunk estimate based on ~4KB slices
  const CHUNK = 4096;
  return Math.max(1, Math.ceil(sizeBytes / CHUNK));
}

// Legacy simple chunking (keeping as fallback)
function chunkText(text: string, chunkSize = 1200, overlap = 200): string[] {
  const t = text.replace(/\r\n/g, '\n');
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkSize);
    const slice = t.slice(i, end);
    chunks.push(slice);
    if (end === t.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

async function externalExtractFromFile(file: File): Promise<string | null> {
  const url = process.env.TEXT_EXTRACTOR_URL;
  if (!url) return null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(url, { method: 'POST', body: fd as any });
    if (!res.ok) return null;
    const data = await res.json().catch(() => undefined);
    const text: string | undefined = data?.text || data?.content;
    return text ? String(text) : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser({ or: 'return-null' });
  if (!user) {
    console.warn('[RAG Upload] Unauthorized access attempt');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const stackUser = user as any;

  const { id: packageId } = await params;
  try {
    const pkg = await getPackageById(packageId);
    if (!pkg) {
      console.error('[RAG Upload] Package not found', { packageId });
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }
    const { targetTeam } = await findTeamForSlug(stackUser, pkg.teamSlug);

    const hasUpdatePermission = targetTeam
      ? ((await stackUser.hasPermission?.(targetTeam, '$update_team')) ?? false)
      : false;

    const normalizedRoles = await collectUserRoles(stackUser.id, stackUser?.serverMetadata);
    const isGlobalAdmin = normalizedRoles.has('global-admin') || normalizedRoles.has('global-rag-admin');
    const hasTeamRole = normalizedRoles.has('team-leader') || normalizedRoles.has('team-owner') || normalizedRoles.has('team-admin');
    const isTeamPrivileged = hasUpdatePermission || hasTeamRole || isGlobalAdmin;

    let hasExplicit = false;
    if (!isTeamPrivileged) {
      const allowed = new Set(await allowedRagIds(pkg.teamSlug, stackUser.id));
      hasExplicit = allowed.has(packageId);
    }
    if (!isTeamPrivileged && !hasExplicit) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const form = await request.formData();
    const files = form.getAll('files');
    if (!files || files.length === 0) {
      console.warn('[RAG Upload] No files provided', { packageId });
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
    }
    // Next.js formData in Node can return File-like objects that don't satisfy instanceof File
    const asFiles = files.flatMap((f) => {
      const anyFile = f as any;
      return anyFile && typeof anyFile.arrayBuffer === 'function' && typeof anyFile.name === 'string'
        ? [anyFile as File]
        : [];
    });

    // Enforce docsProcessed limit (suma de chunks de todos los ficheros)
    let totalChunks = 0;
    for (const f of asFiles) {
      totalChunks += estimateChunks(f.size);
    }
    try {
      await checkAndIncrementUsage(pkg.teamSlug, 'docsProcessed', totalChunks);
    } catch {
      return NextResponse.json({ success: false, error: 'DOCS_LIMIT_REACHED' }, { status: 403 });
    }

    const processed: Array<{ filename: string; chunkCount: number; pointIds: string[] }> = [];
    const failures: Array<{ filename: string; error: string }> = [];

    for (const f of asFiles) {
      const id = randomUUID();
      let documentCreated = false;
      let masterDocId: string | null = null;
      try {
        // PASO 1: Extraer y validar texto PRIMERO
        // Index content in Qdrant
        const type = (f.type || '').toLowerCase();
        const name = (f.name || '').toLowerCase();
        let text = '';

        // Determine if this is a structured document that needs special extraction
        const isPdf = type.includes('pdf') || /\.pdf$/i.test(f.name);
        const isDocx = type.includes('word') || /\.(docx)$/i.test(f.name);
        const isExcel = type.includes('spreadsheet') || type.includes('excel') || /\.(xlsx|xls)$/i.test(f.name);
        const isPowerPoint = type.includes('presentation') || type.includes('powerpoint') || /\.(pptx|ppt)$/i.test(f.name);

        const isStructuredDoc = isPdf || isDocx || isExcel || isPowerPoint;

        // Treat as plain text only if it's NOT a structured document
        const treatAsText = !isStructuredDoc && (
          type.startsWith('text/') ||
          type.includes('markdown') ||
          type.includes('json') ||
          type.includes('csv') ||
          type.includes('html') ||
          type.includes('xml') ||
          type.includes('yaml') ||
          type.includes('rfc822') ||
          name.endsWith('.csv') ||
          name.endsWith('.tsv') ||
          name.endsWith('.yaml') ||
          name.endsWith('.yml') ||
          name.endsWith('.xml') ||
          name.endsWith('.html') ||
          name.endsWith('.htm') ||
          name.endsWith('.eml') ||
          name.endsWith('.msg')
        );

        if (treatAsText) {
          text = await (f as File).text();
        } else if (isStructuredDoc) {
          // Try internal parser first (safe and no external binaries)
          const arrayBuf = await (f as File).arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const extractedInternal = await extractTextFromBuffer(buf, { contentType: type, filename: f.name });

          if (extractedInternal && extractedInternal.trim().length > 0) {
            text = extractedInternal;
          } else {
            // Optional external extractor fallback
            const extracted = await externalExtractFromFile(f as File);
            if (!extracted) {
              console.warn('[RAG Upload] ❌ No extractable text found', {
                packageId,
                filename: f.name,
                documentId: id,
                isPDF: type.includes('pdf') || /\.pdf$/i.test(f.name),
                isDOCX: type.includes('word') || /\.(docx)$/i.test(f.name)
              });
              await dbQuery('UPDATE projectnexus.rag_documents SET chunk_count = $1, point_ids = NULL WHERE id = $2', [0, id]);

              const fileType = type.includes('pdf') ? 'PDF' : type.includes('word') ? 'DOCX' : 'documento';
              failures.push({
                filename: f.name,
                error: `${fileType} no contiene texto extraíble. Puede ser un archivo escaneado (solo imágenes) o protegido. Se requiere OCR para indexar este tipo de archivos.`
              });
              continue;
            }
            text = extracted;
          }
        } else {
          // Unsupported binary; keep metadata only
          await dbQuery('UPDATE projectnexus.rag_documents SET chunk_count = $1, point_ids = NULL WHERE id = $2', [0, id]);
          failures.push({ filename: f.name, error: 'Tipo de archivo no soportado para indexacion' });
          continue;
        }
        const rawLength = typeof text === 'string' ? text.length : 0;

        const hasContent = typeof text === 'string' && text.replace(/\s+/g, '').length > 0;
        if (!hasContent) {
          console.warn('[RAG Upload] Document has no indexable content', { packageId, filename: f.name, documentId: id });
          failures.push({ filename: f.name, error: 'El documento no contiene texto indexable' });
          continue;
        }
        // Use smart chunking with semantic awareness
        const useSmartChunking = process.env.USE_SMART_CHUNKING !== 'false'; // Enabled by default
        const chunks = useSmartChunking
          ? smartChunkText(text, {
            maxChunkSize: 1200,
            minChunkSize: 200,
            overlap: 200,
            preserveParagraphs: true,
            preserveSentences: true,
          })
          : chunkText(text);

        if (chunks.length === 0) {
          console.warn('[RAG Upload] No chunks generated', { packageId, filename: f.name, documentId: id });
          failures.push({ filename: f.name, error: 'El documento no genero fragmentos de texto' });
          continue;
        }
        // PASO 2: Solo ahora crear el documento en BD (después de validar contenido)
        const doc = {
          id,
          filename: f.name,
          size: f.size,
          contentType: f.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          chunkCount: chunks.length,
          pointIds: [],
        };
        await appendDocument(packageId, doc as any);
        documentCreated = true;
        // PASO 2.5: Create master document and assignment for centralized document hub
        try {
          const masterDoc = await createMasterDocument({
            teamSlug: pkg.teamSlug,
            userId: stackUser.id,
            filename: `${Date.now()}-${f.name}`,
            originalFilename: f.name,
            size: f.size,
            contentType: f.type || 'application/octet-stream',
            status: 'processing',
          });
          masterDocId = masterDoc.id;
          await assignDocumentToRags(masterDoc.id, [packageId], stackUser.id);
        } catch (masterDocError) {
          console.warn('[RAG Upload] Failed to create master document (continuing with legacy flow)', { error: masterDocError });
        }

        // PASO 3: Persistir archivo original en MinIO (opcional)
        try {
          const arrayBuf = await (f as File).arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const bucket = process.env.MINIO_BUCKET || 'projectnexus';
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
          const objectKey = `team/${pkg.teamSlug}/packages/${packageId}/docs/${id}-${safeName}`;
          await putObjectBuffer(bucket, objectKey, buf, f.type || 'application/octet-stream');
          await dbQuery(`UPDATE projectnexus.rag_documents SET bucket=$1, object_key=$2 WHERE id=$3`, [bucket, objectKey, id]);
          } catch (minioError) {
          console.warn('[RAG Upload] MinIO storage failed (continuing without backup)', { packageId, documentId: id, filename: f.name, error: minioError instanceof Error ? minioError.message : 'unknown' });
        }

        // PASO 4: Indexar en Qdrant
        await ensureCollection(pkg.collectionName);
        const vectors = await embedTexts(chunks);
        const pointIds: string[] = [];
        const points = vectors.map((vec, idx) => {
          const pid = randomUUID();
          pointIds.push(pid);
          return {
            id: pid,
            vector: vec,
            payload: {
              team_slug: pkg.teamSlug,
              packageId: packageId,
              documentId: id,
              filename: f.name,
              chunkIndex: idx,
              text: chunks[idx],
            },
          };
        });
        await upsertPoints(pkg.collectionName, points as any);
        await dbQuery('UPDATE projectnexus.rag_documents SET chunk_count = $1, point_ids = $2 WHERE id = $3', [chunks.length, pointIds, id]);
        // Update master document status to ready
        if (masterDocId) {
          try {
            await updateAssignmentStatus(masterDocId, packageId, 'ready', { chunkCount: chunks.length });
          } catch (statusError) {
            console.warn('[RAG Upload] Failed to update master document status', { masterDocId, error: statusError });
          }
        }

        processed.push({ filename: f.name, chunkCount: chunks.length, pointIds });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
        console.error(`Failed to process document ${f.name}:`, e);

        // Update master document status to failed
        if (masterDocId) {
          try {
            await dbQuery(
              `UPDATE projectnexus.document_rag_assignments SET status = 'failed', error_message = $1 WHERE master_document_id = $2 AND rag_package_id = $3`,
              [errorMsg, masterDocId, packageId]
            );
            await dbQuery(`UPDATE projectnexus.master_documents SET status = 'failed', error_message = $1 WHERE id = $2`, [errorMsg, masterDocId]);
          } catch (statusError) {
            console.warn('[RAG Upload] Failed to update master document status to failed', { masterDocId, error: statusError });
          }
        }

        // ROLLBACK: Si el documento fue creado pero falló la indexación, eliminarlo
        if (documentCreated) {
          try {
            await dbQuery('DELETE FROM projectnexus.rag_documents WHERE id = $1', [id]);
          } catch (rollbackError) {
            console.error('[RAG Upload] ❌ Failed to rollback document', { packageId, documentId: id, filename: f.name, error: rollbackError });
          }
        }

        failures.push({
          filename: f.name,
          error: `Error al procesar: ${errorMsg}`
        });
      }
    }

    const finalPackage = await getPackageById(packageId);

    return NextResponse.json({ success: true, package: finalPackage, processed, failures });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'UPLOAD_FAILED', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



