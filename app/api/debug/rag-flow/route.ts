import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { allowedRagIds } from '@/lib/authz';
import { listPackages } from '@/lib/rag/store';
import { normalizeQuery, rewriteQuery, retrieveFromQdrant } from '@/lib/rag/query-pipeline';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

/**
 * GET /api/debug/rag-flow?query=test
 * Debug completo del flujo de RAG: autenticación, permisos, packages, búsqueda.
 * Solo opera sobre los packages concedidos al usuario (fail closed, MOK-85):
 * un usuario sin grants no recibe listado ni texto de packages del team.
 */
export async function GET(request: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  try {
    // PASO 1: Autenticación
    debugInfo.steps.step1_auth = { name: 'Autenticación Stack Auth' };
    const user = await stackServerApp.getUser();
    
    if (!user) {
      debugInfo.steps.step1_auth.status = 'FAILED';
      debugInfo.steps.step1_auth.error = 'No autenticado';
      return NextResponse.json(debugInfo, { status: 401 });
    }

    debugInfo.steps.step1_auth.status = 'SUCCESS';
    debugInfo.steps.step1_auth.data = {
      userId: (user as any).id,
      email: (user as any).primaryEmail,
    };

    // PASO 2: Obtener team
    debugInfo.steps.step2_team = { name: 'Obtener Team' };
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      debugInfo.steps.step2_team.status = 'FAILED';
      debugInfo.steps.step2_team.error = 'No team found';
      return NextResponse.json(debugInfo, { status: 404 });
    }

    debugInfo.steps.step2_team.status = 'SUCCESS';
    debugInfo.steps.step2_team.data = {
      teamId: selectedTeam.id,
      teamName: selectedTeam.displayName,
    };

    // PASO 3: Obtener team slug desde DB
    debugInfo.steps.step3_team_slug = { name: 'Obtener Team Slug desde PostgreSQL' };
    const teamId = selectedTeam.id;
    const teamResult = await query<{ slug: string; name: string }>(
      'SELECT slug, name FROM teams WHERE id = $1',
      [teamId]
    );
    
    if (teamResult.rows.length === 0) {
      debugInfo.steps.step3_team_slug.status = 'FAILED';
      debugInfo.steps.step3_team_slug.error = 'Team not found in database';
      return NextResponse.json(debugInfo, { status: 404 });
    }
    
    const teamSlug = teamResult.rows[0].slug;
    debugInfo.steps.step3_team_slug.status = 'SUCCESS';
    debugInfo.steps.step3_team_slug.data = {
      teamSlug,
      teamName: teamResult.rows[0].name,
    };

    // Gate de autorización (MOK-85): calcular los grants de este usuario una
    // sola vez y fallar cerrado, igual que POST /api/rag/query. Los pasos
    // siguientes solo pueden tocar packages concedidos: un set de grants
    // vacío o un chequeo fallido jamás cae a la lista completa del team.
    const userId = (user as any).id;
    let allowedIds: string[] = [];
    let grantCheckError: unknown = null;
    try {
      allowedIds = (await allowedRagIds(teamSlug, userId)) ?? [];
    } catch (error) {
      grantCheckError = error;
    }

    if (grantCheckError) {
      debugInfo.steps.step5_permissions = {
        name: 'Verificar Permisos RAG',
        status: 'ERROR',
        error: grantCheckError instanceof Error ? grantCheckError.message : 'Unknown error',
      };
      debugInfo.refused = 'ACCESS_CHECK_FAILED';
      console.error('[Debug RAG Flow] Grant check failed, refusing to list or search packages');
      return NextResponse.json(debugInfo, { status: 403 });
    }
    if (allowedIds.length === 0) {
      // Antes caía a todos los packages del team; ahora se rechaza con una
      // señal distinta de "sin resultados" para que ops vea la
      // mala configuración en vez de una respuesta benigna vacía.
      debugInfo.steps.step5_permissions = {
        name: 'Verificar Permisos RAG',
        status: 'SUCCESS',
        data: { allowedPackageIds: allowedIds, count: 0 },
      };
      debugInfo.refused = 'NO_RAG_GRANTS';
      console.warn('[Debug RAG Flow] Team/user holds no RAG query grants');
      return NextResponse.json(debugInfo, { status: 403 });
    }

    const grantedIds = new Set(allowedIds);
    let teamPackages: Awaited<ReturnType<typeof listPackages>> = [];

    // PASO 4: Listar RAG packages (solo los concedidos a este usuario)
    debugInfo.steps.step4_packages = { name: 'Listar RAG Packages' };
    try {
      teamPackages = await listPackages(teamSlug, false);
      const visiblePackages = teamPackages.filter(pkg => grantedIds.has(pkg.id));
      debugInfo.steps.step4_packages.status = 'SUCCESS';
      debugInfo.steps.step4_packages.data = {
        count: visiblePackages.length,
        totalTeamPackages: teamPackages.length,
        filteredByUserGrants: true,
        packages: visiblePackages.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          teamSlug: pkg.teamSlug,
          collectionName: pkg.collectionName,
          documentCount: pkg.documents.length,
          documents: pkg.documents.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            chunkCount: doc.chunkCount,
          })),
        })),
      };
    } catch (error) {
      debugInfo.steps.step4_packages.status = 'ERROR';
      debugInfo.steps.step4_packages.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // PASO 5: Verificar permisos RAG (ya calculados en el gate de autorización)
    debugInfo.steps.step5_permissions = {
      name: 'Verificar Permisos RAG',
      status: 'SUCCESS',
      data: {
        allowedPackageIds: allowedIds,
        count: allowedIds.length,
      },
    };

    // PASO 6: Test de búsqueda (si se proporciona query)
    const url = new URL(request.url);
    const testQuery = url.searchParams.get('query');
    
    if (testQuery) {
      debugInfo.steps.step6_search = { name: 'Test de Búsqueda RAG' };
      
      try {
        if (teamPackages.length === 0) {
          debugInfo.steps.step6_search.status = 'SKIPPED';
          debugInfo.steps.step6_search.reason = 'No hay packages disponibles';
        } else {
          // Solo buscar en packages concedidos a este usuario (MOK-85);
          // nunca en la lista completa del team.
          const packageIds = teamPackages.filter(p => grantedIds.has(p.id)).map(p => p.id);

          if (packageIds.length === 0) {
            debugInfo.steps.step6_search.status = 'SKIPPED';
            debugInfo.steps.step6_search.reason = 'No hay packages concedidos a este usuario';
          } else {
            // Normalizar y reescribir query
            const normalized = normalizeQuery(testQuery);
            const { best } = await rewriteQuery(normalized);
            const queries = [best]; // Solo usar la consulta optimizada

            debugInfo.steps.step6_search.queryProcessing = {
              original: testQuery,
              normalized,
              rewritten: best,
              changed: best !== normalized
            };

            // Buscar en Qdrant
            const retrieved = await retrieveFromQdrant({
              teamSlug,
              packageIds,
              queries
            });

            debugInfo.steps.step6_search.status = 'SUCCESS';
            debugInfo.steps.step6_search.data = {
              packagesSearched: packageIds,
              queriesUsed: queries,
              resultsCount: retrieved.length,
              results: retrieved.slice(0, 5).map(r => ({
                score: r.score,
                packageId: r.packageId,
                packageName: r.packageName,
                documentId: r.documentId,
                filename: r.filename,
                textPreview: r.text?.substring(0, 200) + '...',
              })),
            };
          }
        }
      } catch (error) {
        debugInfo.steps.step6_search.status = 'ERROR';
        debugInfo.steps.step6_search.error = error instanceof Error ? error.message : 'Unknown error';
        debugInfo.steps.step6_search.stack = error instanceof Error ? error.stack : undefined;
      }
    } else {
      debugInfo.steps.step6_search = {
        name: 'Test de Búsqueda RAG',
        status: 'SKIPPED',
        hint: 'Agrega ?query=tu_pregunta para probar la búsqueda',
      };
    }

    // PASO 7: Verificar Qdrant directamente
    debugInfo.steps.step7_qdrant = { name: 'Conexión Qdrant' };
    try {
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const qdrantApiKey = process.env.QDRANT_API_KEY;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (qdrantApiKey) {
        headers['api-key'] = qdrantApiKey;
      }
      
      const response = await fetch(`${qdrantUrl}/collections`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        debugInfo.steps.step7_qdrant.status = 'SUCCESS';
        debugInfo.steps.step7_qdrant.data = {
          qdrantUrl,
          collections: data.result?.collections || [],
        };
      } else {
        debugInfo.steps.step7_qdrant.status = 'ERROR';
        debugInfo.steps.step7_qdrant.error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      debugInfo.steps.step7_qdrant.status = 'ERROR';
      debugInfo.steps.step7_qdrant.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    debugInfo.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };
    return NextResponse.json(debugInfo, { status: 500 });
  }
}
