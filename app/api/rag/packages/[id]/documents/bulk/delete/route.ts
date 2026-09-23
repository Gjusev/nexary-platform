import { NextRequest, NextResponse } from 'next/server';

import { getPackageById } from '@/lib/rag/store';
import { deletePoints, deletePointsByFilter } from '@/lib/rag/qdrant';
import { query as dbQuery } from '@/lib/db';
import type { RagPackage } from '@/lib/rag/types';
import { getStackServerAppFromCookies, collectUserRoles, findTeamForSlug } from '@/lib/rag/auth-helpers';

function toSummary(pkg: RagPackage) {
  const documentCount = pkg.documents.length;
  const totalChunks = pkg.documents.reduce((sum, doc) => sum + (doc.chunkCount ?? 0), 0);
  return {
    ...pkg,
    documentCount,
    totalChunks,
  };
}

type DocRow = { id: string; point_ids: string[] | null };

const stackServerApp = getStackServerAppFromCookies();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await stackServerApp.getUser({ or: 'return-null' });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const stackUser = user as any;

  const roles = await collectUserRoles(stackUser.id, stackUser?.serverMetadata);
  const isGlobalAdmin = roles.has('global-admin') || roles.has('global-rag-admin');
  const hasTeamRole = roles.has('team-owner') || roles.has('team-leader') || roles.has('team-admin');

  const { id: packageId } = await params;
  const body = (await request.json().catch(() => undefined)) as { ids?: string[]; hard?: boolean } | undefined;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((v) => typeof v === 'string') : [];
  const hard = body?.hard ?? true;
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: 'No document ids provided' }, { status: 400 });
  }

  const ragPackage = await getPackageById(packageId, true);
  if (!ragPackage) {
    return NextResponse.json({ success: false, error: 'NotFound' }, { status: 404 });
  }

  const { targetTeam } = await findTeamForSlug(stackUser, ragPackage.teamSlug);
  const hasUpdatePermission = targetTeam
    ? ((await stackUser.hasPermission?.(targetTeam, '$update_team')) ?? false)
    : false;

  const isAuthorized = isGlobalAdmin || hasTeamRole || hasUpdatePermission;
  const canOperateOnTeam = isGlobalAdmin || Boolean(targetTeam);

  if (!isAuthorized || !canOperateOnTeam) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  if (!hard) {
    try {
      const deletedBy = stackUser.id ?? '';
      await dbQuery(
        `UPDATE projectnexus.rag_documents SET deleted_at = NOW(), deleted_by = $1 
         WHERE package_id = $2 AND id = ANY($3::uuid[])`,
        [deletedBy, packageId, ids]
      );
      await dbQuery('UPDATE projectnexus.rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);
      const updated = await getPackageById(packageId, true);
      if (!updated) throw new Error('Package not found after soft delete');
      return NextResponse.json({ success: true, package: toSummary(updated) });
    } catch (error) {
      return NextResponse.json({ success: false, error: 'SoftDeleteBulkError' }, { status: 500 });
    }
  }

  try {
    const { rows } = await dbQuery<DocRow>(
      `SELECT id, point_ids FROM projectnexus.rag_documents WHERE package_id = $1 AND id = ANY($2::uuid[])`,
      [packageId, ids]
    );
    const byId = new Map<string, string[]>(rows.map((r) => [r.id, r.point_ids ?? []]));
    const allPointIds: string[] = [];
    const missing: string[] = [];
    for (const id of ids) {
      const pids = byId.get(id) ?? [];
      if (pids.length > 0) allPointIds.push(...pids);
      else missing.push(id);
    }

    if (allPointIds.length > 0) {
      try {
        await deletePoints(ragPackage.collectionName, allPointIds);
      } catch (e) {
        // fall through to per-doc filter deletion below for safety
      }
    }
    for (const docId of missing) {
      try {
        await deletePointsByFilter(ragPackage.collectionName, {
          must: [
            { key: 'documentId', match: { value: docId } },
            { key: 'packageId', match: { value: ragPackage.id } },
          ],
        });
      } catch {}
    }

    await dbQuery('DELETE FROM rag_documents WHERE package_id = $1 AND id = ANY($2::uuid[])', [packageId, ids]);
    await dbQuery('UPDATE rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);
    const updated = await getPackageById(packageId, true);
    if (!updated) throw new Error('Package not found after hard delete');
    return NextResponse.json({ success: true, package: toSummary(updated) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'DeleteBulkError', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
