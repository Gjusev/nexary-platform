/**
 * GET /api/admin/teams
 *
 * Returns a list of all teams with their SSO/SCIM configuration status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

interface TeamListItem {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  ssoType: 'none' | 'saml' | 'oidc' | 'both';
  samlConfigured: boolean;
  oidcConfigured: boolean;
  scimEnabled: boolean;
  enterpriseAuthEnabled: boolean;
  createdAt: Date;
}

export async function GET(req: NextRequest) {
  try {
    // Get teams with member counts and SSO/SCIM status
    const result = await query(`
      SELECT DISTINCT
        t.id,
        t.name,
        t.slug,
        t.sso_type as "ssoType",
        t.enterprise_auth_enabled as "enterpriseAuthEnabled",
        t.created_at as "createdAt",
        COALESCE(tm.member_count, 0) as "memberCount",
        COALESCE(saml_conf.id IS NOT NULL, false) as "samlConfigured",
        COALESCE(oidc_conf.id IS NOT NULL AND oidc_conf.enabled, false) as "oidcConfigured",
        COALESCE(scim_tokens.token_count > 0, false) as "scimEnabled"
      FROM projectnexus.teams t
      LEFT JOIN (
        SELECT team_id, COUNT(*) as member_count
        FROM projectnexus.team_members
        WHERE status = 'active'
        GROUP BY team_id
      ) tm ON tm.team_id = t.id
      LEFT JOIN projectnexus.saml_configurations saml_conf ON saml_conf.team_slug = t.slug
      LEFT JOIN projectnexus.oidc_configurations oidc_conf ON oidc_conf.team_slug = t.slug
      LEFT JOIN (
        SELECT team_slug, COUNT(*) as token_count
        FROM projectnexus.scim_tokens
        WHERE expires_at IS NULL OR expires_at > NOW()
        GROUP BY team_slug
      ) scim_tokens ON scim_tokens.team_slug = t.slug
      ORDER BY t.created_at DESC
    `);

    const teams: TeamListItem[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      memberCount: parseInt(row.memberCount) || 0,
      ssoType: row.ssoType || 'none',
      samlConfigured: row.samlConfigured || false,
      oidcConfigured: row.oidcConfigured || false,
      scimEnabled: row.scimEnabled || false,
      enterpriseAuthEnabled: row.enterpriseAuthEnabled || false,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({
      teams,
      total: teams.length,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}
