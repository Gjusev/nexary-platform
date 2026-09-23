import { NextRequest, NextResponse } from 'next/server';
import { embedTexts } from '@/lib/rag/query-pipeline';
import { searchQdrant } from '@/lib/rag/qdrant';

/**
 * GET /api/debug/test-rag-search?collection=xxx&query=xxx&teamSlug=xxx
 * Prueba directa de búsqueda RAG sin reescritura
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const collectionName = url.searchParams.get('collection');
    const query = url.searchParams.get('query');
    const teamSlug = url.searchParams.get('teamSlug');
    const packageId = url.searchParams.get('packageId');

    if (!collectionName || !query || !teamSlug || !packageId) {
      return NextResponse.json({ 
        error: 'Se requieren parámetros: collection, query, teamSlug, packageId',
        example: '/api/debug/test-rag-search?collection=21-3124-uzae-t1we-xxx&query=Barcelona&teamSlug=21-3124-uzae&packageId=xxx'
      }, { status: 400 });
    }

    // 1. Generar embedding de la query
    const vectors = await embedTexts([query]);
    const vector = vectors[0];

    // 2. Buscar en Qdrant SIN filtros
    const resultsNoFilter = await searchQdrant(collectionName, vector, 5);

    // 3. Buscar en Qdrant CON filtros
    const resultsWithFilter = await searchQdrant(collectionName, vector, 5, {
      must: [
        { key: 'team_slug', match: { value: teamSlug } },
        { key: 'packageId', match: { value: packageId } },
      ],
    });

    return NextResponse.json({
      query,
      collectionName,
      teamSlug,
      packageId,
      vectorLength: vector?.length || 0,
      resultsNoFilter: {
        count: resultsNoFilter.length,
        results: resultsNoFilter.map(r => ({
          score: r.score,
          payload: {
            packageId: r.payload?.packageId,
            teamSlug: r.payload?.team_slug,
            documentId: r.payload?.documentId,
            filename: r.payload?.filename,
            textPreview: String(r.payload?.text || '').substring(0, 200),
          },
        })),
      },
      resultsWithFilter: {
        count: resultsWithFilter.length,
        results: resultsWithFilter.map(r => ({
          score: r.score,
          payload: {
            packageId: r.payload?.packageId,
            teamSlug: r.payload?.team_slug,
            documentId: r.payload?.documentId,
            filename: r.payload?.filename,
            textPreview: String(r.payload?.text || '').substring(0, 200),
          },
        })),
      },
      diagnosis: {
        hasResults: resultsNoFilter.length > 0 || resultsWithFilter.length > 0,
        problem: resultsNoFilter.length === 0 
          ? 'No hay resultados ni siquiera sin filtros. El embedding o el documento pueden estar corruptos.'
          : resultsWithFilter.length === 0
          ? 'Hay resultados sin filtros pero no con filtros. Verifica teamSlug y packageId en los payloads.'
          : null,
      },
    });

  } catch (error) {
    console.error('[test-rag-search] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
