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
 * Debug completo del flujo de RAG: autenticación, permisos, packages, búsqueda
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

    // PASO 4: Listar RAG packages
    debugInfo.steps.step4_packages = { name: 'Listar RAG Packages' };
    try {
      const packages = await listPackages(teamSlug, false);
      debugInfo.steps.step4_packages.status = 'SUCCESS';
      debugInfo.steps.step4_packages.data = {
        count: packages.length,
        packages: packages.map(pkg => ({
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

    // PASO 5: Verificar permisos RAG
    debugInfo.steps.step5_permissions = { name: 'Verificar Permisos RAG' };
    try {
      const userId = (user as any).id;
      const allowed = await allowedRagIds(teamSlug, userId);
      debugInfo.steps.step5_permissions.status = 'SUCCESS';
      debugInfo.steps.step5_permissions.data = {
        allowedPackageIds: allowed,
        count: allowed.length,
      };
    } catch (error) {
      debugInfo.steps.step5_permissions.status = 'ERROR';
      debugInfo.steps.step5_permissions.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // PASO 6: Test de búsqueda (si se proporciona query)
    const url = new URL(request.url);
    const testQuery = url.searchParams.get('query');
    
    if (testQuery) {
      debugInfo.steps.step6_search = { name: 'Test de Búsqueda RAG' };
      
      try {
        // Obtener el primer package disponible
        const packages = await listPackages(teamSlug, false);
        if (packages.length === 0) {
          debugInfo.steps.step6_search.status = 'SKIPPED';
          debugInfo.steps.step6_search.reason = 'No hay packages disponibles';
        } else {
          const packageIds = packages.map(p => p.id);
          
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
