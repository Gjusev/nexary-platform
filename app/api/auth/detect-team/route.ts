/**
 * POST /api/auth/detect-team
 *
 * Detects if an email belongs to an enterprise team configured for SSO.
 * Returns the team slug if found, null otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

// List of non-corporate email providers
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'tutanota.com',
  'mail.com',
  'yandex.com',
  'qq.com',
  '163.com',
  '126.com',
];

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return parts[1].toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if it's a personal email
    if (isPersonalEmail(email)) {
      return NextResponse.json({
        isPersonal: true,
        team: null,
      });
    }

    // Extract domain and search for matching team
    const domain = extractDomain(email);

    const result = await query(
      `SELECT slug, name, sso_type, enterprise_auth_enabled
       FROM projectnexus.teams
       WHERE corporate_domain = $1
         AND enterprise_auth_enabled = true
         AND sso_type IN ('saml', 'oidc', 'both')
       LIMIT 1`,
      [domain]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        isPersonal: false,
        team: null,
      });
    }

    const team = result.rows[0];

    return NextResponse.json({
      isPersonal: false,
      team: {
        slug: team.slug,
        name: team.name,
        ssoType: team.sso_type,
      },
    });
  } catch (error) {
    console.error('Error detecting team from email:', error);
    return NextResponse.json(
      { error: 'Failed to detect team' },
      { status: 500 }
    );
  }
}
