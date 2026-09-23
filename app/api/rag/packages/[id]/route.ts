import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { getPackageById } from '@/lib/rag/store';
import { deleteCollection } from '@/lib/rag/qdrant';
import { removePrefix } from '@/lib/storage/minio';
import { query } from '@/lib/db';
import type { RagPackage } from '@/lib/rag/types';
import { logRagDeletion } from '@/lib/middleware/audit';
import type { StackUser } from '@/lib/types/user';
import { checkRagRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

// Helper to convert RagPackage to RagPackageSummary
function toSummary(pkg: RagPackage) {
  const documentCount = pkg.documents.length;
  const totalChunks = pkg.documents.reduce((sum, doc) => sum + (doc.chunkCount ?? 0), 0);
  return {
    ...pkg,
    documentCount,
    totalChunks,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const pkg = await getPackageById(id, true);
    if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Convert to summary to include documentCount and totalChunks
    return NextResponse.json({ success: true, package: toSummary(pkg) });
  } catch (e) {
    console.error('Failed to fetch package:', e);
    return NextResponse.json({ error: 'Failed to fetch package' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await stackServerApp.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Type assertion: Stack SDK's CurrentServerUser to our StackUser type
  const typedUser = user as unknown as StackUser;

  const { id } = await params;

  try {
    const pkg = await getPackageById(id, true);
    if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Obtener el equipo del usuario
    const teams = await typedUser.listTeams?.() || [];
    const selectedTeam = typedUser.selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ error: 'No team found' }, { status: 404 });
    }

    // Verificar permisos: $update_team (admin/owner) o team-leader/team-owner en PostgreSQL
    const hasUpdatePermission = await typedUser.hasPermission?.(selectedTeam, '$update_team') || false;

    const userEmail = typedUser.primaryEmail || '';
    const teamId = selectedTeam.id;

    const { rows: memberRows } = await query<{ role: string }>(
      'SELECT role FROM team_members WHERE team_id = $1 AND email = $2 AND status = $3',
      [teamId, userEmail, 'active']
    );

    const dbRole = memberRows.length > 0 ? memberRows[0].role : null;
    const isTeamLeaderOrOwner = dbRole === 'team-leader' || dbRole === 'team-owner' || dbRole === 'owner';

    if (!hasUpdatePermission && !isTeamLeaderOrOwner) {
      return NextResponse.json({
        error: 'Forbidden - Team leader or owner access required'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const hard = url.searchParams.get('hard');
    if (hard === '1' || hard === 'true') {
      // Hard delete: Qdrant + MinIO + DB
      try { await deleteCollection(pkg.collectionName); } catch { }
      try {
        const bucket = process.env.MINIO_BUCKET || 'projectnexus';
        const prefix = `team/${pkg.teamSlug}/packages/${id}/`;
        await removePrefix(bucket, prefix);
      } catch { }
      await query('DELETE FROM projectnexus.rag_packages WHERE id = $1', [id]);
    } else {
      // Soft delete: keep data for restore
      const deletedBy = typedUser.id || '';
      await query('UPDATE projectnexus.rag_packages SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE id = $2', [deletedBy, id]);
    }

    // Audit: Log the RAG deletion
    await logRagDeletion({
      actorUserId: typedUser.id || '',
      teamSlug: pkg.teamSlug,
      ragId: id,
      ragName: pkg.name,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
