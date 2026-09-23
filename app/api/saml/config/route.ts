import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { query } from '@/lib/db';
import {
  loadSAMLConfig,
  saveSAMLConfig,
  deleteSAMLConfig,
} from '@/lib/saml/saml-provider';
import { listIdpTemplates, getIdpTemplate } from '@/lib/saml/saml-metadata';

/**
 * GET /api/saml/config?teamSlug=xyz
 * Get SAML configuration for a team
 */
export async function GET(req: NextRequest) {
  try {
    const teamSlug = req.nextUrl.searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug query parameter is required' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getStackUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is owner or leader of the team
    const memberCheck = await query(
      `SELECT role FROM team_members
       WHERE team_id = (SELECT id FROM teams WHERE slug = $1)
       AND user_id = $2
       AND status = 'active'`,
      [teamSlug, user.id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'team-owner' && role !== 'team-leader') {
      return NextResponse.json(
        { error: 'Only team owners and leaders can manage SAML settings' },
        { status: 403 }
      );
    }

    // Load SAML config
    const config = await loadSAMLConfig(teamSlug);

    if (!config) {
      return NextResponse.json({
        configured: false,
        message: 'SAML is not configured for this team',
      });
    }

    // Return config without sensitive certificate details (just show first/last few chars)
    const safeConfig = {
      configured: true,
      idpEntityId: config.idpEntityId,
      idpSsoUrl: config.idpSsoUrl,
      idpSloUrl: config.idpSloUrl,
      idpCert: maskCertificate(config.idpCert),
      spEntityId: config.spEntityId,
      acsUrl: config.acsUrl,
      sloUrl: config.sloUrl,
      nameIdFormat: config.nameIdFormat,
      attributeMapping: config.attributeMapping,
      metadataUrl: `${config.spEntityId}/api/saml/metadata/${teamSlug}`,
    };

    return NextResponse.json(safeConfig);
  } catch (error) {
    console.error('Error getting SAML config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saml/config
 * Create new SAML configuration for a team
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      teamSlug,
      idpEntityId,
      idpSsoUrl,
      idpSloUrl,
      idpCert,
      nameIdFormat,
      attributeMapping,
    } = body;

    // Validate required fields
    if (!teamSlug || !idpEntityId || !idpSsoUrl || !idpCert) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['teamSlug', 'idpEntityId', 'idpSsoUrl', 'idpCert'],
        },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getStackUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is owner or leader of the team
    const memberCheck = await query(
      `SELECT role FROM team_members
       WHERE team_id = (SELECT id FROM teams WHERE slug = $1)
       AND user_id = $2
       AND status = 'active'`,
      [teamSlug, user.id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'team-owner' && role !== 'team-leader') {
      return NextResponse.json(
        { error: 'Only team owners and leaders can manage SAML settings' },
        { status: 403 }
      );
    }

    // Check if config already exists
    const existingConfig = await loadSAMLConfig(teamSlug);
    if (existingConfig) {
      return NextResponse.json(
        { error: 'SAML is already configured for this team. Use PUT to update.' },
        { status: 409 }
      );
    }

    // Validate certificate format
    if (!isValidCertificate(idpCert)) {
      return NextResponse.json(
        { error: 'Invalid X.509 certificate format' },
        { status: 400 }
      );
    }

    // Save SAML config
    await saveSAMLConfig(teamSlug, {
      idpEntityId,
      idpSsoUrl,
      idpSloUrl,
      idpCert: normalizeCertificate(idpCert),
      nameIdFormat,
      attributeMapping,
    });

    // Load and return the saved config
    const config = await loadSAMLConfig(teamSlug);

    return NextResponse.json({
      success: true,
      message: 'SAML configuration saved successfully',
      config: {
        idpEntityId: config!.idpEntityId,
        idpSsoUrl: config!.idpSsoUrl,
        idpSloUrl: config!.idpSloUrl,
        spEntityId: config!.spEntityId,
        acsUrl: config!.acsUrl,
        metadataUrl: `${config!.spEntityId}/api/saml/metadata/${teamSlug}`,
      },
    });
  } catch (error) {
    console.error('Error creating SAML config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/saml/config
 * Update existing SAML configuration
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      teamSlug,
      idpEntityId,
      idpSsoUrl,
      idpSloUrl,
      idpCert,
      nameIdFormat,
      attributeMapping,
    } = body;

    // Validate required fields
    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug is required' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getStackUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is owner or leader of the team
    const memberCheck = await query(
      `SELECT role FROM team_members
       WHERE team_id = (SELECT id FROM teams WHERE slug = $1)
       AND user_id = $2
       AND status = 'active'`,
      [teamSlug, user.id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'team-owner' && role !== 'team-leader') {
      return NextResponse.json(
        { error: 'Only team owners and leaders can manage SAML settings' },
        { status: 403 }
      );
    }

    // Check if config exists
    const existingConfig = await loadSAMLConfig(teamSlug);
    if (!existingConfig) {
      return NextResponse.json(
        { error: 'SAML is not configured for this team. Use POST to create.' },
        { status: 404 }
      );
    }

    // Validate certificate if provided
    if (idpCert && !isValidCertificate(idpCert)) {
      return NextResponse.json(
        { error: 'Invalid X.509 certificate format' },
        { status: 400 }
      );
    }

    // Update SAML config
    await saveSAMLConfig(teamSlug, {
      idpEntityId: idpEntityId || existingConfig.idpEntityId,
      idpSsoUrl: idpSsoUrl || existingConfig.idpSsoUrl,
      idpSloUrl: idpSloUrl || existingConfig.idpSloUrl,
      idpCert: idpCert ? normalizeCertificate(idpCert) : existingConfig.idpCert,
      nameIdFormat: nameIdFormat || existingConfig.nameIdFormat,
      attributeMapping: attributeMapping || existingConfig.attributeMapping,
    });

    // Load and return the updated config
    const config = await loadSAMLConfig(teamSlug);

    return NextResponse.json({
      success: true,
      message: 'SAML configuration updated successfully',
      config: {
        idpEntityId: config!.idpEntityId,
        idpSsoUrl: config!.idpSsoUrl,
        idpSloUrl: config!.idpSloUrl,
        spEntityId: config!.spEntityId,
        acsUrl: config!.acsUrl,
        metadataUrl: `${config!.spEntityId}/api/saml/metadata/${teamSlug}`,
      },
    });
  } catch (error) {
    console.error('Error updating SAML config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saml/config?teamSlug=xyz
 * Delete SAML configuration
 */
export async function DELETE(req: NextRequest) {
  try {
    const teamSlug = req.nextUrl.searchParams.get('teamSlug');

    if (!teamSlug) {
      return NextResponse.json(
        { error: 'teamSlug query parameter is required' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getStackUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is owner of the team (only owners can delete SAML config)
    const memberCheck = await query(
      `SELECT role FROM team_members
       WHERE team_id = (SELECT id FROM teams WHERE slug = $1)
       AND user_id = $2
       AND status = 'active'`,
      [teamSlug, user.id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this team' },
        { status: 403 }
      );
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'team-owner') {
      return NextResponse.json(
        { error: 'Only team owners can delete SAML settings' },
        { status: 403 }
      );
    }

    // Delete SAML config
    await deleteSAMLConfig(teamSlug);

    return NextResponse.json({
      success: true,
      message: 'SAML configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SAML config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/saml/config/templates
 * Get list of available Identity Provider templates
 */
export async function OPTIONS(req: NextRequest) {
  const templates = listIdpTemplates();

  return NextResponse.json({
    templates,
  });
}

/**
 * Mask certificate for display (show only first/last chars)
 */
function maskCertificate(cert: string): string {
  const normalized = normalizeCertificate(cert);
  if (normalized.length < 40) {
    return '***';
  }
  return normalized.substring(0, 20) + '...' + normalized.substring(normalized.length - 20);
}

/**
 * Validate certificate format
 */
function isValidCertificate(cert: string): boolean {
  const normalized = normalizeCertificate(cert);

  // Check for PEM format headers/footers or base64-like content
  const hasHeaders =
    normalized.includes('-----BEGIN CERTIFICATE-----') &&
    normalized.includes('-----END CERTIFICATE-----');

  const base64Pattern = /^[A-Za-z0-9+/=\s]+$/;

  return hasHeaders || base64Pattern.test(normalized.replace(/-----BEGIN|END|CERTIFICATE-----/g, '').trim());
}

/**
 * Normalize certificate (add headers if missing)
 */
function normalizeCertificate(cert: string): string {
  cert = cert.trim();

  // If already has headers, return as-is
  if (
    cert.includes('-----BEGIN CERTIFICATE-----') &&
    cert.includes('-----END CERTIFICATE-----')
  ) {
    return cert;
  }

  // Add headers
  return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
}
