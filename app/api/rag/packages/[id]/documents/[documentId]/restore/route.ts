import { NextRequest, NextResponse } from 'next/server';

import { getPackageById, restoreDocument } from '@/lib/rag/store';
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
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const user = await stackServerApp.getUser({ or: 'return-null' });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const stackUser = user as any;

  const roles = await collectUserRoles(stackUser.id, stackUser?.serverMetadata);
  const isGlobalAdmin = roles.has('global-admin') || roles.has('global-rag-admin');
  const hasTeamRole = roles.has('team-owner') || roles.has('team-leader') || roles.has('team-admin');

  const { id: packageId, documentId } = await params;
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
    const updatedPackage = await restoreDocument(packageId, documentId);
    return NextResponse.json({ success: true, package: toSummary(updatedPackage) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'RestoreDocumentError',
        message: error instanceof Error ? error.message : 'No se pudo restaurar el documento.',
      },
      { status: 500 }
    );
  }
}
