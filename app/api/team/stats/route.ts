import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { query } from '@/lib/db';
import { ensureTeamExists } from '@/lib/ensure-team-sync';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

export async function GET(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener el equipo del usuario (con fallback a listTeams)
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ error: 'Usuario no pertenece a ningún equipo' }, { status: 400 });
    }

    // Obtener el slug del team desde Stack Auth (auto-sync si es necesario)
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug } = await ensureTeamExists(teamId, teamName, 'Team Stats');
    // Obtener número de documentos activos (no eliminados)
    const documentsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM projectnexus.rag_documents rd 
       JOIN projectnexus.rag_packages rp ON rd.package_id = rp.id
       WHERE rp.team_slug = $1 AND rd.deleted_at IS NULL`,
      [teamSlug]
    );
    const totalDocuments = parseInt(documentsResult.rows[0]?.count || '0');
    // Obtener número de vectores activos (suma de chunk_count de documentos no eliminados)
    const vectorsResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(rd.chunk_count), 0) as total 
       FROM projectnexus.rag_documents rd 
       JOIN projectnexus.rag_packages rp ON rd.package_id = rp.id
       WHERE rp.team_slug = $1 AND rd.deleted_at IS NULL`,
      [teamSlug]
    );
    const totalVectors = parseInt(vectorsResult.rows[0]?.total || '0');
    // Obtener número de miembros activos del equipo (usa team_id, no team_slug)
    const membersResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM projectnexus.team_members 
       WHERE team_id = $1 AND status = 'active'`,
      [teamId]
    );
    const totalMembers = parseInt(membersResult.rows[0]?.count || '0');
    // Obtener consultas de hoy (desde el inicio del día UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const queriesTodayResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM projectnexus.chat_messages cm
       JOIN projectnexus.chat_conversations cc ON cm.conversation_id = cc.id
       WHERE cc.team_slug = $1 AND cm.created_at >= $2 AND cm.role = 'user'`,
      [teamSlug, today.toISOString()]
    );
    const queriesToday = parseInt(queriesTodayResult.rows[0]?.count || '0');

    // Calcular porcentajes de cambio (comparar con período anterior)
    // Para documentos: comparar con hace 7 días
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const documentsLastWeekResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM projectnexus.rag_documents rd 
       JOIN projectnexus.rag_packages rp ON rd.package_id = rp.id
       WHERE rp.team_slug = $1 AND rd.deleted_at IS NULL AND rd.uploaded_at < $2`,
      [teamSlug, weekAgo.toISOString()]
    );
    const documentsLastWeek = parseInt(documentsLastWeekResult.rows[0]?.count || '0');
    const documentsChange = documentsLastWeek > 0 
      ? Math.round(((totalDocuments - documentsLastWeek) / documentsLastWeek) * 100)
      : 0;

    // Para consultas: comparar con ayer
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const queriesYesterdayResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM projectnexus.chat_messages cm
       JOIN projectnexus.chat_conversations cc ON cm.conversation_id = cc.id
       WHERE cc.team_slug = $1 AND cm.created_at >= $2 AND cm.created_at < $3 AND cm.role = 'user'`,
      [teamSlug, yesterday.toISOString(), today.toISOString()]
    );
    const queriesYesterday = parseInt(queriesYesterdayResult.rows[0]?.count || '0');
    const queriesChange = queriesYesterday > 0
      ? Math.round(((queriesToday - queriesYesterday) / queriesYesterday) * 100)
      : 0;

    // Para vectores: comparar con hace 7 días
    const vectorsLastWeekResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(rd.chunk_count), 0) as total 
       FROM projectnexus.rag_documents rd 
       JOIN projectnexus.rag_packages rp ON rd.package_id = rp.id
       WHERE rp.team_slug = $1 AND rd.deleted_at IS NULL AND rd.uploaded_at < $2`,
      [teamSlug, weekAgo.toISOString()]
    );
    const vectorsLastWeek = parseInt(vectorsLastWeekResult.rows[0]?.total || '0');
    const vectorsChange = vectorsLastWeek > 0
      ? Math.round(((totalVectors - vectorsLastWeek) / vectorsLastWeek) * 100)
      : 0;

    // Para miembros: comparar con hace 7 días (usa team_id, no team_slug)
    const membersLastWeekResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM projectnexus.team_members 
       WHERE team_id = $1 AND status = 'active' AND joined_at < $2`,
      [teamId, weekAgo.toISOString()]
    );
    const membersLastWeek = parseInt(membersLastWeekResult.rows[0]?.count || '0');
    const membersChange = membersLastWeek > 0
      ? Math.round(((totalMembers - membersLastWeek) / membersLastWeek) * 100)
      : 0;

    const statsResponse = {
      success: true,
      stats: {
        documents: {
          total: totalDocuments,
          change: documentsChange,
        },
        queries: {
          today: queriesToday,
          change: queriesChange,
        },
        vectors: {
          total: totalVectors,
          change: vectorsChange,
        },
        members: {
          total: totalMembers,
          change: membersChange,
        },
      },
    };

    return NextResponse.json(statsResponse);
  } catch (error) {
    console.error('❌ [API Stats] Error fetching team stats:', error);
    console.error('❌ [API Stats] Stack trace:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      success: false,
      error: 'Error fetching stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
