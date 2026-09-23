import { NextRequest, NextResponse } from 'next/server';

import { getPackageById } from '@/lib/rag/store';
import { query as dbQuery } from '@/lib/db';
import { getStackServerAppFromCookies, collectUserRoles, findTeamForSlug } from '@/lib/rag/auth-helpers';

type DocumentRow = {
  id: string;
  package_id: string;
  filename: string;
  size: string | number;
  content_type: string;
  uploaded_at: Date;
  chunk_count: number;
  point_ids: string[] | null;
  deleted_at: Date | null;
};

const stackServerApp = getStackServerAppFromCookies();

export async function GET(
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
    const { rows } = await dbQuery<DocumentRow>(
      `SELECT id, package_id, filename, size, content_type, uploaded_at, chunk_count, point_ids, deleted_at
       FROM projectnexus.rag_documents
       WHERE package_id = $1 AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [packageId]
    );

    const documents = rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      size: typeof row.size === 'string' ? Number(row.size) : row.size,
      contentType: row.content_type,
      uploadedAt: row.uploaded_at.toISOString(),
      chunkCount: row.chunk_count,
      pointIds: row.point_ids ?? undefined,
    }));

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'LIST_DELETED_FAILED', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
