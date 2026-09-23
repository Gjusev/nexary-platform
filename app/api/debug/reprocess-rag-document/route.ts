import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { embedTexts } from '@/lib/rag/query-pipeline';

/**
 * POST /api/debug/reprocess-rag-document
 * Reprocesa un documento RAG regenerando sus embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { packageId, documentId } = body;

    if (!packageId || !documentId) {
      return NextResponse.json({ 
        error: 'Se requieren packageId y documentId',
        example: { 
          packageId: '8eba2be4-0656-4cc4-860d-d24b52ee69e3',
          documentId: '8fa6a358-c50e-442d-9a86-cb6922db18d8'
        }
      }, { status: 400 });
    }

    // 1. Obtener información del package
    const packageResult = await query<{
      id: string;
      name: string;
      team_slug: string;
      collection_name: string;
    }>(
      'SELECT id, name, team_slug, collection_name FROM rag_packages WHERE id = $1',
      [packageId]
    );

    if (packageResult.rows.length === 0) {
      return NextResponse.json({ error: 'Package no encontrado' }, { status: 404 });
    }

    const pkg = packageResult.rows[0];

    // 2. Obtener información del documento desde PostgreSQL
    const docResult = await query<{
      id: string;
      filename: string;
      point_ids: string[] | null;
    }>(
      'SELECT id, filename, point_ids FROM rag_documents WHERE id = $1 AND package_id = $2',
      [documentId, packageId]
    );

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const doc = docResult.rows[0];
    const oldPointIds = doc.point_ids || [];

    // 3. Obtener los puntos actuales de Qdrant
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (qdrantApiKey) {
      headers['api-key'] = qdrantApiKey;
    }

    // Obtener puntos actuales del documento
    const scrollResponse = await fetch(`${qdrantUrl}/collections/${pkg.collection_name}/points/scroll`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'documentId', match: { value: documentId } },
            { key: 'packageId', match: { value: packageId } },
          ],
        },
        limit: 100,
        with_payload: true,
        with_vector: false,
      }),
    });

    if (!scrollResponse.ok) {
      return NextResponse.json({
        error: 'Error al obtener puntos de Qdrant',
        status: scrollResponse.status,
      }, { status: 500 });
    }

    const scrollData = await scrollResponse.json();
    const existingPoints = scrollData.result?.points || [];

    if (existingPoints.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron puntos en Qdrant para este documento',
        suggestion: 'El documento puede necesitar ser re-ingested completamente',
      }, { status: 404 });
    }

    // 4. Regenerar embeddings para cada chunk
    const newPoints = [];
    for (const point of existingPoints) {
      const text = String(point.payload?.text || '');
      if (!text) continue;

      // Generar nuevo embedding
      const vectors = await embedTexts([text]);
      const newVector = vectors[0];

      newPoints.push({
        id: point.id,
        vector: newVector,
        payload: point.payload,
      });
    }

    // 5. Actualizar puntos en Qdrant
    const upsertResponse = await fetch(`${qdrantUrl}/collections/${pkg.collection_name}/points`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        points: newPoints,
      }),
    });

    if (!upsertResponse.ok) {
      const errorText = await upsertResponse.text();
      return NextResponse.json({
        error: 'Error al actualizar puntos en Qdrant',
        status: upsertResponse.status,
        details: errorText,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Documento reprocesado correctamente',
      results: {
        packageId: pkg.id,
        packageName: pkg.name,
        documentId: doc.id,
        filename: doc.filename,
        collectionName: pkg.collection_name,
        pointsProcessed: newPoints.length,
        oldPointIds: oldPointIds,
        newPointIds: newPoints.map(p => p.id),
      },
    });

  } catch (error) {
    console.error('[reprocess-rag-document] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
