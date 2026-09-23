import { NextRequest, NextResponse } from 'next/server';

import { getPackageById } from '@/lib/rag/store';
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
  const body = (await request.json().catch(() => undefined)) as { ids?: string[] } | undefined;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((v) => typeof v === 'string') : [];
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

  try {
    await dbQuery(
      `UPDATE projectnexus.rag_documents SET deleted_at = NULL, deleted_by = NULL 
       WHERE package_id = $1 AND id = ANY($2::uuid[])`,
      [packageId, ids]
    );
    await dbQuery('UPDATE projectnexus.rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);

    const updated = await getPackageById(packageId, true);
    if (!updated) throw new Error('Package not found after restore');
    return NextResponse.json({ success: true, package: toSummary(updated) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'RestoreBulkError',
        message: error instanceof Error ? error.message : 'No se pudieron restaurar documentos.',
      },
      { status: 500 }
    );
  }
}
