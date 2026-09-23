import { NextRequest, NextResponse } from 'next/server';

import { deletePoints, deletePointsByFilter } from '@/lib/rag/qdrant';
import { getPackageById, removeDocument } from '@/lib/rag/store';
import type { RagPackage } from '@/lib/rag/types';
import { getStackServerAppFromCookies, collectUserRoles, findTeamForSlug } from '@/lib/rag/auth-helpers';

const stackServerApp = getStackServerAppFromCookies();

function toSummary(pkg: RagPackage) {
  const documentCount = pkg.documents.length;
  const totalChunks = pkg.documents.reduce((sum, doc) => sum + (doc.chunkCount ?? 0), 0);
  return {
    ...pkg,
    documentCount,
    totalChunks,
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const user = await stackServerApp.getUser({ or: 'return-null' });
  if (!user) {
    console.warn('[RAG Delete] Unauthorized access attempt');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const stackUser = user as any;

  const roles = await collectUserRoles(stackUser.id, stackUser?.serverMetadata);
  const isGlobalAdmin = roles.has('global-admin') || roles.has('global-rag-admin');
  const hasTeamRole = roles.has('team-owner') || roles.has('team-leader') || roles.has('team-admin');

  const { id: packageId, documentId } = await params;
  const ragPackage = await getPackageById(packageId, true);

  if (!ragPackage) {
    console.error('[RAG Delete] Package not found', { packageId });
    return NextResponse.json({ success: false, error: 'NotFound' }, { status: 404 });
  }
  const { targetTeam } = await findTeamForSlug(stackUser, ragPackage.teamSlug);
  const hasUpdatePermission = targetTeam
    ? ((await stackUser.hasPermission?.(targetTeam, '$update_team')) ?? false)
    : false;

  const isAuthorized = isGlobalAdmin || hasTeamRole || hasUpdatePermission;
  const canOperateOnTeam = isGlobalAdmin || Boolean(targetTeam);

  if (!isAuthorized || !canOperateOnTeam) {
    console.warn('[RAG Delete] Forbidden: insufficient permissions', { packageId, documentId, userId: stackUser.id });
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const hard = url.searchParams.get('hard');
    const doHard = hard === '1' || hard === 'true';
    // PASO 1: Obtener información del documento antes de eliminarlo
    const { updatedPackage, removedDocument } = await removeDocument(
      packageId,
      documentId,
      doHard,
      stackUser.id,
      doHard // deleteFromQdrant flag
    );
    // PASO 2: Si es hard delete o soft delete, intentar eliminar de Qdrant
    // Para soft delete, también eliminamos de Qdrant para evitar resultados de búsqueda
    let qdrantDeleteSuccess = false;
    const pointIds = removedDocument.pointIds ?? [];
    
    if (pointIds.length > 0) {
      // Método 1: Intentar eliminar por IDs específicos
      try {
        await deletePoints(updatedPackage.collectionName, pointIds);
        qdrantDeleteSuccess = true;
        } catch (pointError) {
        console.error('[RAG Delete] ⚠️ Failed to delete vectors by IDs', { packageId, documentId, pointCount: pointIds.length, error: pointError });
        
        // Método 2 (Fallback): Intentar eliminar por filtro
        try {
          await deletePointsByFilter(updatedPackage.collectionName, {
            must: [
              { key: 'documentId', match: { value: documentId } },
              { key: 'packageId', match: { value: packageId } },
            ],
          });
          qdrantDeleteSuccess = true;
        } catch (fallbackError) {
          // Deletion failed, but continue
        }
      }
    } else {
      // No hay pointIds, intentar solo por filtro
      try {
        await deletePointsByFilter(updatedPackage.collectionName, {
          must: [
            { key: 'documentId', match: { value: documentId } },
            { key: 'packageId', match: { value: packageId } },
          ],
        });
        qdrantDeleteSuccess = true;
      } catch (filterError) {
        // Deletion failed, but continue
      }
    }

    // PASO 3: Responder con información completa
    const response: any = { 
      success: true, 
      package: toSummary(updatedPackage),
      qdrantDeleted: qdrantDeleteSuccess
    };
    
    if (!qdrantDeleteSuccess) {
      response.warning = 'Documento eliminado de la BD pero algunos vectores pueden permanecer en Qdrant';
      console.warn('[RAG Delete] ⚠️ Deletion completed with warning', { packageId, documentId, warning: response.warning });
    } else {
      }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Error removing document ${documentId} from package ${packageId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'RemoveDocumentError',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el documento.',
      },
      { status: 500 }
    );
  }
}
