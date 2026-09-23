import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { hasPermission, isGlobalAdmin } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions-config';
import {
  logPHIAccess,
  getPHIAccessLogs,
  getPHIAccessStats,
  markResourceAsPHI,
  resourceContainsPHI,
  getPHIResources,
  createBAAAgreement,
  getBAAAgreements,
  updateBAAStatus,
  createRiskAssessment,
  getRiskAssessments,
  updateRiskAssessment,
  getRiskAssessmentSummary,
  getHIPAAComplianceSummary,
} from '@/lib/hipaa/hipaa-service';

/**
 * GET /api/admin/compliance/hipaa
 * Get HIPAA compliance summary and data
 *
 * Query parameters:
 * - summary: Return HIPAA compliance summary
 * - phi-logs: Return PHI access logs
 * - phi-resources: Return PHI resources for team
 * - baa: Return BAA agreements for team
 * - risks: Return risk assessments
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const searchParams = req.nextUrl.searchParams;
    const getSummary = searchParams.get('summary') === 'true';
    const phiLogs = searchParams.get('phi-logs') === 'true';
    const phiResources = searchParams.get('phi-resources');
    const baaAgreements = searchParams.get('baa');
    const risks = searchParams.get('risks') === 'true';
    const teamSlug = searchParams.get('teamSlug');

    // Compliance summary
    if (getSummary) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only administrators can view HIPAA compliance summary' },
          { status: 403 }
        );
      }

      const summary = await getHIPAAComplianceSummary(teamSlug || undefined);
      return NextResponse.json({ summary });
    }

    // PHI access logs
    if (phiLogs) {
      const hasViewPermission = teamSlug
        ? await hasPermission(user.id, teamSlug, PERMISSIONS.SECURITY_VIEW_AUDIT_LOGS)
        : isAdmin;

      if (!hasViewPermission) {
        return NextResponse.json(
          { error: 'You do not have permission to view PHI access logs' },
          { status: 403 }
        );
      }

      const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined;
      const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined;
      const limit = parseInt(searchParams.get('limit') || '100');

      const logs = await getPHIAccessLogs({
        userId: searchParams.get('userId') || undefined,
        resourceId: searchParams.get('resourceId') || undefined,
        teamSlug: teamSlug || undefined,
        startDate,
        endDate,
        limit,
      });

      const stats = await getPHIAccessStats(teamSlug || undefined);

      return NextResponse.json({ logs, stats });
    }

    // PHI resources
    if (phiResources) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only administrators can view PHI resources' },
          { status: 403 }
        );
      }

      const resources = await getPHIResources(phiResources);
      return NextResponse.json({ resources });
    }

    // BAA agreements
    if (baaAgreements) {
      const hasManagePermission = await hasPermission(
        user.id,
        baaAgreements,
        PERMISSIONS.SECURITY_MANAGE_SSO
      );

      if (!hasManagePermission && !isAdmin) {
        return NextResponse.json(
          { error: 'You do not have permission to view BAA agreements' },
          { status: 403 }
        );
      }

      const agreements = await getBAAAgreements(baaAgreements);
      return NextResponse.json({ agreements });
    }

    // Risk assessments
    if (risks) {
      const assessments = await getRiskAssessments(teamSlug || undefined);
      const riskSummary = await getRiskAssessmentSummary(teamSlug || undefined);

      return NextResponse.json({ assessments, summary: riskSummary });
    }

    // Default: return compliance summary for admin
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can view HIPAA compliance data' },
        { status: 403 }
      );
    }

    const [assessments, summary] = await Promise.all([
      getRiskAssessments(teamSlug || undefined),
      getHIPAAComplianceSummary(teamSlug || undefined),
    ]);

    return NextResponse.json({ assessments, summary });
  } catch (error) {
    console.error('HIPAA compliance GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/compliance/hipaa
 * Create HIPAA compliance records
 *
 * Body: {
 *   action: 'log-access' | 'mark-phi' | 'create-baa' | 'create-risk',
 *   ...action-specific fields
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const body = await req.json();
    const { action } = body;

    // Log PHI access
    if (action === 'log-access') {
      const {
        resourceId,
        resourceType,
        accessType,
        purpose,
        purposeDetails,
        authorizedBy,
        teamSlug,
      } = body;

      if (!resourceId || !resourceType || !accessType || !purpose) {
        return NextResponse.json(
          { error: 'resourceId, resourceType, accessType, and purpose are required' },
          { status: 400 }
        );
      }

      await logPHIAccess({
        userId: user.id,
        resourceId,
        resourceType,
        accessType,
        purpose,
        purposeDetails,
        authorizedBy,
        teamSlug,
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      });

      return NextResponse.json({ success: true });
    }

    // Mark resource as containing PHI
    if (action === 'mark-phi') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only administrators can mark resources as containing PHI' },
          { status: 403 }
        );
      }

      const { resourceId, resourceType, teamSlug } = body;

      if (!resourceId || !resourceType) {
        return NextResponse.json(
          { error: 'resourceId and resourceType are required' },
          { status: 400 }
        );
      }

      await markResourceAsPHI(resourceId, resourceType, teamSlug);

      return NextResponse.json({ success: true, message: 'Resource marked as containing PHI' });
    }

    // Create BAA agreement
    if (action === 'create-baa') {
      const { teamSlug, vendorName, vendorContactEmail, effectiveDate, expirationDate, documentUrl, terms } = body;

      if (!teamSlug || !vendorName || !vendorContactEmail || !effectiveDate || !terms) {
        return NextResponse.json(
          { error: 'teamSlug, vendorName, vendorContactEmail, effectiveDate, and terms are required' },
          { status: 400 }
        );
      }

      const hasManagePermission = await hasPermission(
        user.id,
        teamSlug,
        PERMISSIONS.SECURITY_MANAGE_SSO
      );

      if (!hasManagePermission && !isAdmin) {
        return NextResponse.json(
          { error: 'You do not have permission to create BAA agreements' },
          { status: 403 }
        );
      }

      const agreement = await createBAAAgreement({
        teamSlug,
        vendorName,
        vendorContactEmail,
        effectiveDate: new Date(effectiveDate),
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        documentUrl,
        terms,
      });

      return NextResponse.json({ success: true, agreement }, { status: 201 });
    }

    // Create risk assessment
    if (action === 'create-risk') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only administrators can create risk assessments' },
          { status: 403 }
        );
      }

      const { teamSlug, title, threatType, likelihood, impact, mitigationMeasures } = body;

      if (!title || !threatType || !likelihood || !impact) {
        return NextResponse.json(
          { error: 'title, threatType, likelihood, and impact are required' },
          { status: 400 }
        );
      }

      const assessment = await createRiskAssessment({
        teamSlug,
        title,
        threatType,
        likelihood,
        impact,
        mitigationMeasures: mitigationMeasures || [],
      });

      return NextResponse.json({ success: true, assessment }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('HIPAA compliance POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/compliance/hipaa
 * Update HIPAA compliance records
 *
 * Body: {
 *   action: 'update-baa-status' | 'update-risk',
 *   ...action-specific fields
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);
    const body = await req.json();
    const { action } = body;

    // Update BAA status
    if (action === 'update-baa-status') {
      const { agreementId, status } = body;

      if (!agreementId || !status) {
        return NextResponse.json(
          { error: 'agreementId and status are required' },
          { status: 400 }
        );
      }

      // Check if user has permission for this team's BAA
      const baaResult = await fetch(
        `${process.env.NEXTAUTH_URL}/api/admin/compliance/hipaa?baa=${body.teamSlug}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            cookie: req.headers.get('cookie') || '',
          },
        }
      );

      if (!baaResult.ok) {
        return NextResponse.json({ error: 'Failed to verify BAA' }, { status: 400 });
      }

      const baaData = await baaResult.json();
      const agreement = baaData.agreements.find((a: any) => a.id === agreementId);

      if (!agreement) {
        return NextResponse.json({ error: 'BAA agreement not found' }, { status: 404 });
      }

      const hasManagePermission = await hasPermission(
        user.id,
        agreement.teamSlug,
        PERMISSIONS.SECURITY_MANAGE_SSO
      );

      if (!hasManagePermission && !isAdmin) {
        return NextResponse.json(
          { error: 'You do not have permission to update BAA agreements' },
          { status: 403 }
        );
      }

      await updateBAAStatus(agreementId, status);

      return NextResponse.json({ success: true });
    }

    // Update risk assessment
    if (action === 'update-risk') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only administrators can update risk assessments' },
          { status: 403 }
        );
      }

      const { assessmentId, updates } = body;

      if (!assessmentId || !updates) {
        return NextResponse.json(
          { error: 'assessmentId and updates are required' },
          { status: 400 }
        );
      }

      const assessment = await updateRiskAssessment(assessmentId, updates);

      return NextResponse.json({ success: true, assessment });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('HIPAA compliance PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
