import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateSCIMToken, hashToken } from '@/lib/scim/scim-middleware';
import { getStackUser } from '@/lib/stack/get-stack-user';

/**
 * GET /api/scim/config
 * Get SCIM configuration for a team
 * Returns tokens with masked values (for security)
 */
export async function GET(req: NextRequest) {
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    // Check if user is team owner or leader
    const memberResult = await query(
      `SELECT role FROM team_members WHERE team_slug = $1 AND user_id = $2`,
      [teamSlug, user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const member = memberResult.rows[0];
    if (member.role !== 'team-owner' && member.role !== 'team-leader') {
      return NextResponse.json(
        { error: 'Only team owners and leaders can manage SCIM' },
        { status: 403 }
      );
    }

    // Get SCIM tokens for the team
    const tokensResult = await query(
      `SELECT id, name, last_used, expires_at, created_at, created_by
       FROM scim_tokens
       WHERE team_slug = $1
       ORDER BY created_at DESC`,
      [teamSlug]
    );

    const tokens = tokensResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      lastUsed: row.last_used,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      // Token is not exposed in GET requests
    }));

    return NextResponse.json({
      enabled: tokens.length > 0,
      tokens,
    });
  } catch (error) {
    console.error('SCIM config GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scim/config
 * Create a new SCIM bearer token
 */
export async function POST(req: NextRequest) {
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { teamSlug, name } = body;

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Token name is required' },
        { status: 400 }
      );
    }

    // Check if user is team owner
    const memberResult = await query(
      `SELECT role FROM team_members WHERE team_slug = $1 AND user_id = $2`,
      [teamSlug, user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const member = memberResult.rows[0];
    if (member.role !== 'team-owner') {
      return NextResponse.json(
        { error: 'Only team owners can create SCIM tokens' },
        { status: 403 }
      );
    }

    // Generate new token
    const token = generateSCIMToken();
    const tokenHash = hashToken(token);

    // Store token in database
    const result = await query(
      `INSERT INTO scim_tokens (team_slug, token_hash, name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [teamSlug, tokenHash, name.trim(), user.id]
    );

    const newToken = {
      id: result.rows[0].id,
      name: name.trim(),
      token, // Only return the full token during creation
      createdAt: result.rows[0].created_at,
    };

    return NextResponse.json(newToken, { status: 201 });
  } catch (error) {
    console.error('SCIM config POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scim/config
 * Revoke a SCIM bearer token
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get current user
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const teamSlug = searchParams.get('teamSlug');
    const tokenId = searchParams.get('tokenId');

    if (!teamSlug || !tokenId) {
      return NextResponse.json(
        { error: 'teamSlug and tokenId are required' },
        { status: 400 }
      );
    }

    // Check if user is team owner
    const memberResult = await query(
      `SELECT role FROM team_members WHERE team_slug = $1 AND user_id = $2`,
      [teamSlug, user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const member = memberResult.rows[0];
    if (member.role !== 'team-owner') {
      return NextResponse.json(
        { error: 'Only team owners can revoke SCIM tokens' },
        { status: 403 }
      );
    }

    // Delete token
    await query(
      `DELETE FROM scim_tokens WHERE id = $1 AND team_slug = $2`,
      [tokenId, teamSlug]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SCIM config DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
