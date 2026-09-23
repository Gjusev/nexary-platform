import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { query } from '@/lib/db';
import { checkAdminRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest) {
  // Security: Rate limiting check
  const rateLimitResponse = checkAdminRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Authorization: Check global-admin role
  const session = await getServerSession(authOptions);
  const roles = session?.roles || [];
  if (!session || !roles.includes('global-admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const samlStatus = searchParams.get('samlStatus'); // 'configured' | 'not-configured' | 'all'
    const scimStatus = searchParams.get('scimStatus'); // 'enabled' | 'disabled' | 'all'

    // Build query with filters
    let queryText = `
      SELECT
        t.id::text,
        t.slug,
        t.name,
        t.description,
        t.created_at,
        COUNT(DISTINCT tm.user_id) filter (where tm.status = 'active') as member_count,
        EXISTS(
          SELECT 1 FROM projectnexus.saml_configurations sc
          WHERE sc.team_slug = t.slug
        ) as saml_configured,
        EXISTS(
          SELECT 1 FROM projectnexus.scim_tokens st
          WHERE st.team_slug = t.slug
        ) as scim_enabled
      FROM projectnexus.teams t
      LEFT JOIN projectnexus.team_members tm ON tm.team_id = t.id
      WHERE 1=1
    `;

    const params: string[] = [];
    let paramIndex = 1;

    if (search) {
      queryText += ` AND (t.name ILIKE $${paramIndex} OR t.slug ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (samlStatus === 'configured') {
      queryText += ` AND EXISTS (SELECT 1 FROM projectnexus.saml_configurations sc WHERE sc.team_slug = t.slug)`;
    } else if (samlStatus === 'not-configured') {
      queryText += ` AND NOT EXISTS (SELECT 1 FROM projectnexus.saml_configurations sc WHERE sc.team_slug = t.slug)`;
    }

    if (scimStatus === 'enabled') {
      queryText += ` AND EXISTS (SELECT 1 FROM projectnexus.scim_tokens st WHERE st.team_slug = t.slug)`;
    } else if (scimStatus === 'disabled') {
      queryText += ` AND NOT EXISTS (SELECT 1 FROM projectnexus.scim_tokens st WHERE st.team_slug = t.slug)`;
    }

    queryText += ` GROUP BY t.id, t.slug, t.name, t.description, t.created_at ORDER BY t.created_at DESC`;

    const result = await query<any>(queryText, params);

    return NextResponse.json({
      teams: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
