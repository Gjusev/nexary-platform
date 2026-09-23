import { NextRequest, NextResponse } from 'next/server';

import { getPackageById } from '@/lib/rag/store';
import { deletePoints } from '@/lib/rag/qdrant';
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

  const ragPackage = await getPackageById(packageId, true);
  if (!ragPackage) {
    return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
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
    const { rows: deletedDocs } = (await dbQuery(
      'SELECT id, point_ids FROM projectnexus.rag_documents WHERE package_id = $1 AND deleted_at IS NOT NULL',
      [packageId]
    )) as { rows: DocRow[] };

    if (deletedDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents in trash to delete',
        package: toSummary(ragPackage),
      });
    }

    const allPointIds: string[] = [];
    deletedDocs.forEach((doc) => {
      if (doc.point_ids && Array.isArray(doc.point_ids)) {
        allPointIds.push(...doc.point_ids);
      }
    });

    if (allPointIds.length > 0) {
      try {
        await deletePoints(ragPackage.collectionName, allPointIds);
      } catch (qdrantError) {
        console.warn('Failed to delete some points from Qdrant during trash empty:', qdrantError);
      }
    }

    await dbQuery(
      'DELETE FROM projectnexus.rag_documents WHERE package_id = $1 AND deleted_at IS NOT NULL',
      [packageId]
    );

    await dbQuery('UPDATE projectnexus.rag_packages SET updated_at = NOW() WHERE id = $1', [packageId]);

    const updatedPackage = await getPackageById(packageId);
    if (!updatedPackage) {
      return NextResponse.json({ success: false, error: 'Package not found after cleanup' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Permanently deleted ${deletedDocs.length} document(s) from trash`,
      deletedCount: deletedDocs.length,
      package: toSummary(updatedPackage),
    });
  } catch (error) {
    console.error('Error emptying trash:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to empty trash',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
