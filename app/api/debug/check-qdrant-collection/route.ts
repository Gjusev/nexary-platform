import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/check-qdrant-collection?collection=xxx
 * Verifica el contenido de una colección en Qdrant
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const collectionName = url.searchParams.get('collection');

    if (!collectionName) {
      return NextResponse.json({ 
        error: 'Se requiere parámetro collection',
        example: '/api/debug/check-qdrant-collection?collection=21-3124-uzae-t1we-xxx'
      }, { status: 400 });
    }

    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (qdrantApiKey) {
      headers['api-key'] = qdrantApiKey;
    }

    // 1. Obtener información de la colección
    const collectionInfoResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
      method: 'GET',
      headers,
    });

    if (!collectionInfoResponse.ok) {
      return NextResponse.json({
        error: `Error al obtener colección: ${collectionInfoResponse.status} ${collectionInfoResponse.statusText}`,
      }, { status: collectionInfoResponse.status });
    }

    const collectionInfo = await collectionInfoResponse.json();

    // 2. Scroll para obtener algunos puntos de ejemplo
    const scrollResponse = await fetch(`${qdrantUrl}/collections/${collectionName}/points/scroll`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        limit: 5,
        with_payload: true,
        with_vector: false, // No incluir vectores para no sobrecargar la respuesta
      }),
    });

    let points = [];
    if (scrollResponse.ok) {
      const scrollData = await scrollResponse.json();
      points = scrollData.result?.points || [];
    }

    // 3. Buscar con un query simple
    const searchResponse = await fetch(`${qdrantUrl}/collections/${collectionName}/points/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vector: Array(3072).fill(0.1), // Vector de prueba (dimensión OpenAI)
        limit: 3,
        with_payload: true,
      }),
    });

    let searchResults = [];
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      searchResults = searchData.result || [];
    }

    return NextResponse.json({
      qdrantUrl,
      collectionName,
      collectionInfo: collectionInfo.result,
      pointsCount: collectionInfo.result?.points_count || 0,
      vectorSize: collectionInfo.result?.config?.params?.vectors?.size || 'unknown',
      samplePoints: points.map((p: any) => ({
        id: p.id,
        payload: p.payload,
      })),
      testSearch: {
        resultsCount: searchResults.length,
        results: searchResults.map((r: any) => ({
          score: r.score,
          payload: r.payload,
        })),
      },
      diagnosis: {
        hasPoints: (collectionInfo.result?.points_count || 0) > 0,
        searchWorks: searchResults.length > 0,
        problem: (collectionInfo.result?.points_count || 0) === 0 
          ? 'La colección existe pero no tiene puntos (vectores). El documento no se procesó correctamente.'
          : searchResults.length === 0
          ? 'La colección tiene puntos pero la búsqueda no devuelve resultados. Puede ser un problema de embeddings.'
          : null,
      },
    });

  } catch (error) {
    console.error('[check-qdrant-collection] Error:', error);
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
