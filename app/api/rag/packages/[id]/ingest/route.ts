import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { getPackageById, appendDocument } from '@/lib/rag/store';
import { getObjectAsString, getObjectBuffer } from '@/lib/storage/minio';
import { query as dbQuery } from '@/lib/db';
import { ensureCollection, upsertPoints } from '@/lib/rag/qdrant';
import { embedTexts } from '@/lib/rag/query-pipeline';
import { checkAndIncrementUsage } from '@/lib/billing/limits';
import { randomUUID } from 'crypto';
import { extractTextFromBuffer } from '@/lib/rag/text-extract';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

function chunkText(text: string, chunkSize = 1200, overlap = 200): string[] {
  const t = text.replace(/\r\n/g, '\n');
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkSize);
    const slice = t.slice(i, end);
    chunks.push(slice);
    if (end === t.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: packageId } = await params;
  const body = await request.json().catch(() => ({}));
  const { bucket, objectKey, filename, contentType } = body || {};
  if (!bucket || !objectKey || !filename) return NextResponse.json({ error: 'bucket, objectKey, filename required' }, { status: 400 });

  try {
    const pkg = await getPackageById(packageId);
    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    
    // Verificar permisos: $update_team (admin/owner) o team-leader/team-owner en PostgreSQL
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'No team found' }, { status: 404 });
    }

    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
    const userEmail = (user as any).primaryEmail || '';
    const teamId = selectedTeam.id;
    
    const { rows: memberRows } = await dbQuery<{ role: string }>(
      'SELECT role FROM team_members WHERE team_id = $1 AND email = $2 AND status = $3',
      [teamId, userEmail, 'active']
    );
    
    const dbRole = memberRows.length > 0 ? memberRows[0].role : null;
    const isTeamLeaderOrOwner = dbRole === 'team-leader' || dbRole === 'team-owner' || dbRole === 'owner';
    
    if (!hasUpdatePermission && !isTeamLeaderOrOwner) {
      return NextResponse.json({ error: 'Forbidden - Team leader or owner access required' }, { status: 403 });
    }

    // fetch object and extract text
    let text = '';
    const ct = String(contentType || '').toLowerCase();
    try {
      const name = String(filename || '').toLowerCase();
      const treatAsText =
        ct.startsWith('text/') ||
        ct.includes('markdown') ||
        ct.includes('json') ||
        ct.includes('csv') ||
        ct.includes('html') ||
        ct.includes('xml') ||
        ct.includes('yaml') ||
        ct.includes('rfc822') ||
        name.endsWith('.csv') ||
        name.endsWith('.tsv') ||
        name.endsWith('.yaml') ||
        name.endsWith('.yml') ||
        name.endsWith('.xml') ||
        name.endsWith('.html') ||
        name.endsWith('.htm') ||
        name.endsWith('.eml') ||
        name.endsWith('.msg');
      if (treatAsText) {
        text = await getObjectAsString(bucket, objectKey);
      } else {
        const buf = await getObjectBuffer(bucket, objectKey);
        const extractedInternal = await extractTextFromBuffer(buf, { contentType: ct, filename });
        if (extractedInternal && extractedInternal.trim().length > 0) {
          text = extractedInternal;
        } else {
          const extractor = process.env.TEXT_EXTRACTOR_URL;
          if (!extractor) {
            return NextResponse.json({ error: 'No text extractor configured for binary content' }, { status: 501 });
          }
          const payload = { filename, contentType: contentType || 'application/octet-stream', data: buf.toString('base64') };
          const res = await fetch(extractor, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!res.ok) return NextResponse.json({ error: 'Extractor failed' }, { status: 502 });
          const data = await res.json().catch(() => ({}));
          text = String(data?.text || data?.content || '');
          if (!text) return NextResponse.json({ error: 'Extractor returned empty text' }, { status: 502 });
        }
      }
    } catch (e) {
      return NextResponse.json({ error: 'Failed to get/extract object' }, { status: 502 });
    }
    const rawLength = typeof text === 'string' ? text.length : 0;
    if (rawLength > 0) {
      const preview = (text as string).slice(0, 120).replace(/\\s+/g, ' ');
      } else {
      console.warn('[RAG ingest] extracted empty text', { filename, contentType: ct });
    }
    const hasContent = typeof text === 'string' && text.replace(/\\s+/g, '').length > 0;
    if (!hasContent) {
      return NextResponse.json({ error: 'Documento sin texto extraible' }, { status: 422 });
    }
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Documento no genero fragmentos de texto' }, { status: 422 });
    }

    // limits
    await checkAndIncrementUsage(pkg.teamSlug, 'docsProcessed', chunks.length);

    // store doc metadata
    const docId = randomUUID();
    await appendDocument(packageId, {
      id: docId,
      filename,
      size: text.length,
      contentType: contentType || 'text/plain',
      uploadedAt: new Date().toISOString(),
      chunkCount: chunks.length,
      pointIds: [],
    } as any);

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
          packageId,
          documentId: docId,
          filename,
          chunkIndex: idx,
          text: chunks[idx],
        },
      };
    });
    await upsertPoints(pkg.collectionName, points as any);
    await dbQuery('UPDATE projectnexus.rag_documents SET point_ids = $1 WHERE id = $2', [pointIds, docId]);

    return NextResponse.json({ success: true, packageId, documentId: docId, chunks: chunks.length });
  } catch (e) {
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}



