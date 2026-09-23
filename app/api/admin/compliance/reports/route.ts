import { NextRequest, NextResponse } from 'next/server';
import { getStackUser } from '@/lib/stack/get-stack-user';
import { isGlobalAdmin } from '@/lib/permissions';
import {
  generateGDPRReport,
  generateSOC2Report,
  generateHIPAAReport,
  exportReportToJSON,
  exportReportToCSV,
  saveReport,
  listReports,
  getReport,
  type ComplianceFramework,
  type ReportFormat,
} from '@/lib/compliance/report-generator';

/**
 * GET /api/admin/compliance/reports
 * List compliance reports or generate a new one
 *
 * Query parameters:
 * - action: 'list' | 'generate'
 * - framework: 'gdpr' | 'soc2' | 'hipaa' (for generate)
 * - period: 'monthly' | 'quarterly' | 'annual' (for generate)
 * - month: 1-12 (for monthly reports)
 * - year: year (for all reports)
 * - quarter: 1-4 (for quarterly reports)
 * - teamSlug: optional team filter (for GDPR/HIPAA)
 * - format: 'json' | 'csv' (for export)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can access compliance reports' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action') || 'list';
    const format = (searchParams.get('format') || 'json') as ReportFormat;

    if (action === 'generate') {
      return handleGenerate(searchParams, user.id, format);
    } else if (action === 'get') {
      const reportId = searchParams.get('reportId');
      if (!reportId) {
        return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
      }
      return handleGetReport(reportId, format);
    } else {
      return handleList(searchParams);
    }
  } catch (error) {
    console.error('Compliance reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/compliance/reports
 * Generate and save a new compliance report
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getStackUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isGlobalAdmin(user.id);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can generate compliance reports' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      framework,
      period,
      month,
      year,
      quarter,
      teamSlug,
    } = body;

    if (!framework || !year) {
      return NextResponse.json(
        { error: 'framework and year are required' },
        { status: 400 }
      );
    }

    // Generate report based on framework
    let report;
    const currentYear = new Date().getFullYear();

    if (framework === 'gdpr') {
      if (!month) {
        return NextResponse.json(
          { error: 'month is required for GDPR reports' },
          { status: 400 }
        );
      }
      report = await generateGDPRReport(month, year, teamSlug);
    } else if (framework === 'soc2') {
      if (period === 'quarterly' && !quarter) {
        return NextResponse.json(
          { error: 'quarter is required for quarterly SOC 2 reports' },
          { status: 400 }
        );
      }
      report = await generateSOC2Report(period || 'quarterly', year, quarter);
    } else if (framework === 'hipaa') {
      if (!month) {
        return NextResponse.json(
          { error: 'month is required for HIPAA reports' },
          { status: 400 }
        );
      }
      report = await generateHIPAAReport(month, year, teamSlug);
    } else {
      return NextResponse.json(
        { error: 'Invalid framework. Use gdpr, soc2, or hipaa' },
        { status: 400 }
      );
    }

    // Save report to database
    await saveReport(report);

    // Log report generation
    await logAuditEvent({
      userId: user.id,
      action: 'COMPLIANCE_REPORT_GENERATED',
      metadata: {
        framework,
        period: report.period,
        reportId: report.id,
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      framework: report.framework,
      period: report.period,
      startDate: report.startDate,
      endDate: report.endDate,
      generatedAt: report.generatedAt,
    });
  } catch (error) {
    console.error('Compliance report generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

async function handleGenerate(searchParams: URLSearchParams, userId: string, format: ReportFormat) {
  const framework = searchParams.get('framework') as ComplianceFramework;
  const period = searchParams.get('period') as 'monthly' | 'quarterly' | 'annual' | null;
  const month = searchParams.get('month');
  const year = searchParams.get('year');
  const quarter = searchParams.get('quarter');
  const teamSlug = searchParams.get('teamSlug');

  if (!framework || !year) {
    return NextResponse.json(
      { error: 'framework and year are required' },
      { status: 400 }
    );
  }

  const yearNum = parseInt(year);
  const monthNum = month ? parseInt(month) : undefined;
  const quarterNum = quarter ? parseInt(quarter) : undefined;

  let report;

  if (framework === 'gdpr') {
    if (!monthNum) {
      return NextResponse.json(
        { error: 'month is required for GDPR reports' },
        { status: 400 }
      );
    }
    report = await generateGDPRReport(monthNum, yearNum, teamSlug || undefined);
  } else if (framework === 'soc2') {
    const soc2Period: 'quarterly' | 'annual' = period === 'annual' ? 'annual' : 'quarterly';
    if (soc2Period === 'quarterly' && !quarterNum) {
      return NextResponse.json(
        { error: 'quarter is required for quarterly SOC 2 reports' },
        { status: 400 }
      );
    }
    report = await generateSOC2Report(soc2Period, yearNum, quarterNum);
  } else if (framework === 'hipaa') {
    if (!monthNum) {
      return NextResponse.json(
        { error: 'month is required for HIPAA reports' },
        { status: 400 }
      );
    }
    report = await generateHIPAAReport(monthNum, yearNum, teamSlug || undefined);
  } else {
    return NextResponse.json(
      { error: 'Invalid framework. Use gdpr, soc2, or hipaa' },
      { status: 400 }
    );
  }

  // Save report to database
  await saveReport(report);

  // Log report generation
  await logAuditEvent({
    userId,
    action: 'COMPLIANCE_REPORT_GENERATED',
    metadata: {
      framework,
      period: report.period,
      reportId: report.id,
    },
  });

  // Return export
  if (format === 'csv') {
    const csv = await exportReportToCSV(report);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="compliance-${framework}-${report.id}.csv"`,
      },
    });
  } else {
    const json = await exportReportToJSON(report);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="compliance-${framework}-${report.id}.json"`,
      },
    });
  }
}

async function handleGetReport(reportId: string, format: ReportFormat) {
  const report = await getReport(reportId);

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (format === 'csv') {
    const csv = await exportReportToCSV(report);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="compliance-${report.framework}-${report.id}.csv"`,
      },
    });
  } else {
    const json = await exportReportToJSON(report);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="compliance-${report.framework}-${report.id}.json"`,
      },
    });
  }
}

async function handleList(searchParams: URLSearchParams) {
  const framework = searchParams.get('framework') as ComplianceFramework | null;
  const period = searchParams.get('period') as 'monthly' | 'quarterly' | 'annual' | null;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const filters: any = {
    limit,
    offset,
  };

  if (framework) filters.framework = framework;
  if (period) filters.period = period;
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);

  const reports = await listReports(filters);

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      framework: r.framework,
      period: r.period,
      startDate: r.startDate,
      endDate: r.endDate,
      generatedAt: r.generatedAt,
      generatedBy: r.generatedBy,
    })),
    pagination: {
      limit,
      offset,
      total: reports.length,
    },
  });
}

async function logAuditEvent(params: {
  userId: string;
  action: string;
  metadata?: Record<string, any>;
}) {
  const { query } = await import('@/lib/db');

  await query(
    `INSERT INTO projectnexus.audit_logs (id, actor_user_id, action, target_type, metadata, created_at)
     VALUES (gen_random_uuid(), $1, $2, 'compliance_report', $3, NOW())`,
    [params.userId, params.action, JSON.stringify(params.metadata || {})]
  );
}
