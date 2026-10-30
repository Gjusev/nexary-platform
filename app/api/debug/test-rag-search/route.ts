import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { allowedRagIds } from '@/lib/authz';
import { listPackages } from '@/lib/rag/store';
import { embedTexts } from '@/lib/rag/query-pipeline';
import { searchQdrant } from '@/lib/rag/qdrant';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * GET /api/debug/test-rag-search?query=xxx&packageId=xxx
 * Prueba directa de búsqueda RAG sin reescritura.
 *
 * Seguro por diseño (MOK-93): requiere sesión, el team y la colección se
 * resuelven en el servidor a partir del llamante (nunca de parámetros del
 * cliente), el package pedido debe estar concedido al usuario, y la búsqueda
 * lleva siempre filtros de team + package. Sin rama "sin filtros" y sin
 * stack traces en la respuesta.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Autenticación (igual que /api/debug/rag-flow)
    const user = await stackServerApp.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Team del llamante desde la sesión (el parámetro teamSlug ya no se acepta)
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ error: 'No team found' }, { status: 404 });
    }

    // 3. Team slug desde la base de datos
    const teamResult = await query<{ slug: string; name: string }>(
      'SELECT slug, name FROM teams WHERE id = $1',
      [selectedTeam.id]
    );

    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: 'Team not found in database' }, { status: 404 });
    }

    const teamSlug = teamResult.rows[0].slug;
    const userId = (user as any).id;

    // 4. Parámetros del cliente: solo query y packageId
    const url = new URL(request.url);
    const queryText = url.searchParams.get('query');
    const packageId = url.searchParams.get('packageId');

    if (!queryText || !packageId) {
      return NextResponse.json({
        error: 'Se requieren parámetros: query, packageId',
        example: '/api/debug/test-rag-search?query=Barcelona&packageId=xxx',
        note: 'El team y la colección se resuelven en el servidor a partir de tu sesión.',
      }, { status: 400 });
    }

    // 5. Gate de autorización fail-closed (contrato MOK-77): un set de grants
    //    vacío o un chequeo fallido jamás procede a listar o buscar.
    let allowedIds: string[] = [];
    try {
      allowedIds = (await allowedRagIds(teamSlug, userId)) ?? [];
    } catch (grantError) {
      console.error('[test-rag-search] Grant check failed, refusing to search:', grantError);
      return NextResponse.json({
        query: queryText,
        packageId,
        refused: 'ACCESS_CHECK_FAILED',
        error: 'No se pudieron verificar los permisos RAG; búsqueda rechazada.',
      }, { status: 403 });
    }

    if (allowedIds.length === 0) {
      console.warn('[test-rag-search] Caller holds no RAG query grants');
      return NextResponse.json({
        query: queryText,
        packageId,
        refused: 'NO_RAG_GRANTS',
        error: 'Tu usuario/team no tiene permisos de consulta RAG.',
      }, { status: 403 });
    }

    // 6. Resolver la colección en el servidor: solo el package pedido, y solo
    //    si pertenece al team del llamante. Un packageId de otro team (o un
    //    parámetro collection arbitrario) no llega a Qdrant nunca.
    const teamPackages = await listPackages(teamSlug, false);
    const pkg = teamPackages.find(p => p.id === packageId && p.teamSlug === teamSlug);

    if (!pkg) {
      return NextResponse.json({
        query: queryText,
        packageId,
        teamSlug,
        error: 'Package no encontrado en tu team',
      }, { status: 404 });
    }

    // 7. El package debe estar concedido explícitamente a este usuario
    const grantedIds = new Set(allowedIds);

    if (!grantedIds.has(pkg.id)) {
      console.warn(`[test-rag-search] Package ${pkg.id} not granted to user ${userId}`);
      return NextResponse.json({
        query: queryText,
        packageId,
        teamSlug,
        refused: 'PACKAGE_NOT_GRANTED',
        error: 'Este package no está concedido a tu usuario.',
      }, { status: 403 });
    }

    // 8. Generar embedding de la query
    const vectors = await embedTexts([queryText]);
    const vector = vectors[0];

    // 9. Búsqueda SIEMPRE filtrada por el team + package resueltos en el servidor
    const results = await searchQdrant(pkg.collectionName, vector, 5, {
      must: [
        { key: 'team_slug', match: { value: teamSlug } },
        { key: 'packageId', match: { value: pkg.id } },
      ],
    });

    return NextResponse.json({
      query: queryText,
      packageId,
      teamSlug,
      package: {
        id: pkg.id,
        name: pkg.name,
        teamSlug: pkg.teamSlug,
        collectionName: pkg.collectionName,
      },
      vectorLength: vector?.length || 0,
      results: {
        count: results.length,
        items: results.map(r => ({
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
        hasResults: results.length > 0,
        problem: results.length === 0
          ? 'Sin resultados en la colección del package concedido. Verifica que el documento esté ingerido y que los payloads incluyan team_slug y packageId correctos.'
          : null,
      },
    });

  } catch (error) {
    // Sin detalles ni stack en la respuesta (MOK-93); solo log del servidor.
    console.error('[test-rag-search] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
