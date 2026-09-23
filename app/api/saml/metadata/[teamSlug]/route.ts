import { NextRequest, NextResponse } from 'next/server';
import { generateTeamSAMLMetadata, listIdpTemplates } from '@/lib/saml/saml-metadata';
import { loadSAMLConfig } from '@/lib/saml/saml-provider';

/**
 * GET /api/saml/metadata/[teamSlug]
 * Returns SAML 2.0 Service Provider metadata XML
 *
 * This endpoint is called by Identity Providers to get the SP configuration
 * The XML can be downloaded and uploaded to IdPs like Okta, Azure AD, etc.
 *
 * Query params:
 * - download=true: Returns file download instead of XML response
 *
 * Response: Content-Type: application/xml (or application/samlmetadata+xml)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;
    const searchParams = req.nextUrl.searchParams;
    const download = searchParams.get('download') === 'true';

    // Validate team slug
    if (!teamSlug || teamSlug.length < 2) {
      return NextResponse.json(
        { error: 'Invalid team slug' },
        { status: 400 }
      );
    }

    // Check if SAML is configured for this team
    const config = await loadSAMLConfig(teamSlug);

    if (!config) {
      return NextResponse.json(
        {
          error: 'SAML is not configured for this team',
          message: 'Please configure SAML settings first in the dashboard',
        },
        { status: 404 }
      );
    }

    // Generate metadata XML
    const metadata = await generateTeamSAMLMetadata(teamSlug);

    if (!metadata) {
      return NextResponse.json(
        { error: 'Failed to generate metadata' },
        { status: 500 }
      );
    }

    // Return XML response
    const response = new NextResponse(metadata, {
      status: 200,
      headers: {
        'Content-Type': 'application/samlmetadata+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

    // If download requested, set Content-Disposition header
    if (download) {
      response.headers.set(
        'Content-Disposition',
        `attachment; filename="saml-metadata-${teamSlug}.xml"`
      );
    }

    return response;
  } catch (error) {
    console.error('Error in SAML metadata endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/saml/metadata/templates (no teamSlug)
 * Returns list of available Identity Provider templates
 *
 * Response:
 * {
 *   "templates": [
 *     {
 *       "id": "okta",
 *       "name": "Okta",
 *       "instructions": "..."
 *     },
 *     ...
 *   ]
 * }
 */
export async function generateStaticParams() {
  // This function generates static params for static generation
  // For SAML metadata, we don't want static generation since it's dynamic
  return [];
}

// Alternative endpoint for listing IdP templates
// This would be at /api/saml/metadata (without teamSlug)
// but since we're using dynamic routes, we'll handle it differently
export const dynamic = 'force-dynamic';
