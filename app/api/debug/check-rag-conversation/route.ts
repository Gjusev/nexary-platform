import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/debug/check-rag-conversation?conversationId=xxx
 * Verifica qué RAG packages están asignados a una conversación específica
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ 
        error: 'Se requiere parámetro conversationId',
        example: '/api/debug/check-rag-conversation?conversationId=xxx'
      }, { status: 400 });
    }

    // Obtener la conversación
    const conversationResult = await query<{ 
      id: string;
      user_email: string;
      team_slug: string;
      title: string;
      rag_package_ids: string[];
    }>(
      'SELECT id, user_email, team_slug, title, rag_package_ids FROM chat_conversations WHERE id = $1',
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const conversation = conversationResult.rows[0];

    // Obtener información de los RAG packages
    const packageInfo = [];
    if (conversation.rag_package_ids && conversation.rag_package_ids.length > 0) {
      for (const packageId of conversation.rag_package_ids) {
        const pkgResult = await query<{
          id: string;
          name: string;
          team_slug: string;
          collection_name: string;
        }>(
          'SELECT id, name, team_slug, collection_name FROM rag_packages WHERE id = $1',
          [packageId]
        );

        if (pkgResult.rows.length > 0) {
          const pkg = pkgResult.rows[0];

          // Verificar permisos de team
          const teamPermResult = await query<{
            can_query: boolean;
            can_ingest: boolean;
          }>(
            'SELECT can_query, can_ingest FROM rag_team_assignments WHERE rag_id = $1 AND team_slug = $2',
            [packageId, conversation.team_slug]
          );

          packageInfo.push({
            id: pkg.id,
            name: pkg.name,
            teamSlug: pkg.team_slug,
            collectionName: pkg.collection_name,
            hasTeamPermissions: teamPermResult.rows.length > 0,
            permissions: teamPermResult.rows[0] || null,
          });
        }
      }
    }

    // Verificar colecciones en Qdrant
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (qdrantApiKey) {
      headers['api-key'] = qdrantApiKey;
    }

    let qdrantCollections: any[] = [];
    try {
      const response = await fetch(`${qdrantUrl}/collections`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        qdrantCollections = data.result?.collections || [];
      }
    } catch (error) {
      console.error('Error fetching Qdrant collections:', error);
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        userEmail: conversation.user_email,
        teamSlug: conversation.team_slug,
        ragPackageIds: conversation.rag_package_ids,
      },
      ragPackages: packageInfo,
      qdrant: {
        url: qdrantUrl,
        collections: qdrantCollections,
        expectedCollections: packageInfo.map(p => p.collectionName),
      },
      diagnosis: {
        hasRagPackagesAssigned: conversation.rag_package_ids?.length > 0,
        allPackagesHavePermissions: packageInfo.every(p => p.hasTeamPermissions),
        allCollectionsExistInQdrant: packageInfo.every(p => 
          qdrantCollections.some((c: any) => c.name === p.collectionName)
        ),
      },
    });

  } catch (error) {
    console.error('[check-rag-conversation] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
