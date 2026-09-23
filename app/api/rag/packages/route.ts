import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { z } from 'zod';

import { createPackage, listPackages } from '@/lib/rag/store';
import { enforceRagCreationLimit } from '@/lib/billing/limits';
import type { RagPackage } from '@/lib/rag/types';
import { query } from '@/lib/db';
import { checkRagRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

const createPackageSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().max(280).optional(),
});

function toSummary(pkg: RagPackage) {
  const documentCount = pkg.documents.length;
  const totalChunks = pkg.documents.reduce((sum, doc) => sum + (doc.chunkCount ?? 0), 0);
  return {
    ...pkg,
    documentCount,
    totalChunks,
  };
}

export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el equipo del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];
    
    if (!selectedTeam) {
      return NextResponse.json({ success: false, error: 'No team found' }, { status: 404 });
    }

    // Obtener el slug del team desde la base de datos usando el ID de Stack Auth
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    
    // Primero intentar obtener desde la base de datos
    let teamResult = await query<{ slug: string }>(
      'SELECT slug FROM teams WHERE id = $1',
      [teamId]
    );
    
    // Si no existe, crear el team en PostgreSQL automáticamente
    if (teamResult.rows.length === 0) {
      // Insertar el team en la base de datos
      await query(
        `INSERT INTO teams (id, slug, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [teamId, teamName, teamName]
      );
      
      // Volver a consultar
      teamResult = await query<{ slug: string }>(
        'SELECT slug FROM teams WHERE id = $1',
        [teamId]
      );
    }
    
    const teamSlug = teamResult.rows[0].slug;
    const url = new URL(request.url);
    const include = url.searchParams.get('include');
    const deletedOnly = include === 'deleted';
    const packages = await listPackages(teamSlug, deletedOnly);
    return NextResponse.json({ success: true, packages: packages.map(toSummary) });
  } catch (error) {
    console.error('[GET /api/rag/packages] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkRagRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el equipo del usuario
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ success: false, error: 'No team found' }, { status: 404 });
    }

    // Verificar permisos: el usuario debe tener permiso $update_team (admin/owner) o ser team-leader
    const hasUpdatePermission = await (user as any).hasPermission?.(selectedTeam, '$update_team') || false;
    // Verificar también el rol en PostgreSQL
    const userEmail = (user as any).primaryEmail || '';
    const teamId = selectedTeam.id;
    
    const { rows: memberRows } = await query<{ role: string }>(
      'SELECT role FROM team_members WHERE team_id = $1 AND email = $2 AND status = $3',
      [teamId, userEmail, 'active']
    );
    
    const dbRole = memberRows.length > 0 ? memberRows[0].role : null;
    const isTeamLeaderOrOwner = dbRole === 'team-leader' || dbRole === 'team-owner' || dbRole === 'owner';
    if (!hasUpdatePermission && !isTeamLeaderOrOwner) {
      return NextResponse.json({ 
        success: false, 
        error: 'Forbidden - Team leader or owner access required',
        debug: { hasUpdatePermission, dbRole }
      }, { status: 403 });
    }

    // Obtener el slug del team desde la base de datos usando el ID de Stack Auth
    const teamName = selectedTeam.displayName || 'Team';
    
    // Primero intentar obtener desde la base de datos
    let teamResult = await query<{ slug: string }>(
      'SELECT slug FROM teams WHERE id = $1',
      [teamId]
    );
    
    // Si no existe, crear el team en PostgreSQL automáticamente
    if (teamResult.rows.length === 0) {
      // Insertar el team en la base de datos
      await query(
        `INSERT INTO teams (id, slug, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [teamId, teamName, teamName]
      );
      
      // Volver a consultar
      teamResult = await query<{ slug: string }>(
        'SELECT slug FROM teams WHERE id = $1',
        [teamId]
      );
    }
    
    const teamSlug = teamResult.rows[0].slug;
    const body = await request.json();
    const { name, description } = createPackageSchema.parse(body);

    // Enforce team plan limits before creating
    await enforceRagCreationLimit(teamSlug);

    const pkg = await createPackage({
      teamSlug,
      name,
      description,
    });

    return NextResponse.json({ success: true, package: toSummary(pkg) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'ValidationError', details: error.flatten() },
        { status: 400 }
      );
    }

    if ((error as any)?.code === 'limit_rags') {
      return NextResponse.json({ success: false, error: 'RAG_LIMIT_REACHED' }, { status: 403 });
    }

    console.error('[POST /api/rag/packages] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'CreatePackageError',
        message: error instanceof Error ? error.message : 'RAG-Paket konnte nicht erstellt werden.',
      },
      { status: 500 }
    );
  }
}

