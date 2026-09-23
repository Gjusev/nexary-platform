/**
 * AI Cost Analytics Endpoint
 *
 * GET - Get cost analytics for the team
 * PUT - Update cost settings (budget, alert threshold)
 */

import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import {
  getCostAnalytics,
  getCostSettings,
  updateCostSettings,
} from '@/lib/ai/cost-tracker';
import { query } from '@/lib/db';
import { ensureTeamExists } from '@/lib/ensure-team-sync';
import { checkTeamRateLimit } from '@/lib/middleware/api-rate-limit';

const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
});

// GET - Get cost analytics for the team
export async function GET(request: NextRequest) {
  // Rate limiting check
  const rateLimitResponse = checkTeamRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's team
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ error: 'User does not belong to a team' }, { status: 400 });
    }

    // Get team slug
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug } = await ensureTeamExists(teamId, teamName, 'Cost Analytics GET');
    // Check if user has permission to view analytics
    const hasReadPermission = await (user as any).hasPermission?.(selectedTeam, 'read:teams') || false;
    if (!hasReadPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (days < 1 || days > 365) {
      return NextResponse.json({ error: 'Days must be between 1 and 365' }, { status: 400 });
    }

    // Get cost analytics
    const analytics = await getCostAnalytics(teamSlug, days);

    // Get cost settings
    const settings = await getCostSettings(teamSlug);

    // Get pending alerts
    const { rows: alertRows } = await query<{
      id: string;
      alert_type: string;
      percentage_used: number;
      monthly_spend_usd: string;
      budget_usd: string;
      created_at: Date;
    }>(
      `SELECT id, alert_type, percentage_used, monthly_spend_usd, budget_usd, created_at
       FROM projectnexus.ai_budget_alerts
       WHERE team_slug = $1 AND dismissed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [teamSlug]
    );

    const alerts = alertRows.map(row => ({
      id: row.id,
      alertType: row.alert_type,
      percentageUsed: row.percentage_used,
      monthlySpendUsd: parseFloat(row.monthly_spend_usd),
      budgetUsd: parseFloat(row.budget_usd),
      createdAt: row.created_at,
    }));

    // Calculate current percentage of budget used
    let budgetPercentage = 0;
    let budgetStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (settings?.monthlyBudgetUsd && settings.monthlyBudgetUsd > 0) {
      budgetPercentage = (settings.currentMonthlySpendUsd / settings.monthlyBudgetUsd) * 100;
      if (budgetPercentage >= 100) {
        budgetStatus = 'exceeded';
      } else if (budgetPercentage >= settings.alertThresholdPercentage) {
        budgetStatus = 'warning';
      }
    }

    return NextResponse.json({
      success: true,
      analytics: {
        totalSpend: analytics.totalSpend,
        totalRequests: analytics.totalRequests,
        totalTokens: analytics.totalTokens,
        byProvider: analytics.byProvider,
        byModel: analytics.byModel,
        dailySpend: analytics.dailySpend,
      },
      settings: settings ? {
        monthlyBudgetUsd: settings.monthlyBudgetUsd,
        currentMonthlySpendUsd: settings.currentMonthlySpendUsd,
        alertThresholdPercentage: settings.alertThresholdPercentage,
        currentMonthStartDate: settings.currentMonthStartDate,
        budgetPercentage,
        budgetStatus,
      } : null,
      alerts,
    });

  } catch (error) {
    console.error('❌ [Cost Analytics GET] Error:', error);
    console.error('❌ [Cost Analytics GET] Stack trace:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch cost analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// PUT - Update cost settings
export async function PUT(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's team
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ error: 'User does not belong to a team' }, { status: 400 });
    }

    // Check if user has permission to update settings
    const hasWritePermission = await (user as any).hasPermission?.(selectedTeam, 'write:teams') || false;
    if (!hasWritePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get team slug
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug } = await ensureTeamExists(teamId, teamName, 'Cost Analytics PUT');
    const body = await request.json();
    const { monthlyBudgetUsd, alertThresholdPercentage } = body;

    // Validate input
    const updates: { monthlyBudgetUsd?: number; alertThresholdPercentage?: number } = {};

    if (monthlyBudgetUsd !== undefined && monthlyBudgetUsd !== null) {
      const budget = parseFloat(monthlyBudgetUsd);
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json({ error: 'Invalid budget amount' }, { status: 400 });
      }
      updates.monthlyBudgetUsd = budget;
      }

    if (alertThresholdPercentage !== undefined && alertThresholdPercentage !== null) {
      const threshold = parseInt(alertThresholdPercentage, 10);
      if (isNaN(threshold) || threshold < 1 || threshold > 100) {
        return NextResponse.json({ error: 'Alert threshold must be between 1 and 100' }, { status: 400 });
      }
      updates.alertThresholdPercentage = threshold;
      }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update settings
    await updateCostSettings(teamSlug, updates);

    // Log the update action
    const userEmail = (user as any).primaryEmail || '';
    await query(
      `INSERT INTO projectnexus.team_audit_logs (id, team_slug, user_email, action, details, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [teamSlug, userEmail, 'cost_settings_updated', JSON.stringify(updates)]
    );

    // Get updated settings
    const settings = await getCostSettings(teamSlug);

    return NextResponse.json({
      success: true,
      message: 'Cost settings updated successfully',
      settings: settings ? {
        monthlyBudgetUsd: settings.monthlyBudgetUsd,
        currentMonthlySpendUsd: settings.currentMonthlySpendUsd,
        alertThresholdPercentage: settings.alertThresholdPercentage,
        currentMonthStartDate: settings.currentMonthStartDate,
      } : null,
    });

  } catch (error) {
    console.error('❌ [Cost Analytics PUT] Error:', error);
    console.error('❌ [Cost Analytics PUT] Stack trace:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      success: false,
      error: 'Failed to update cost settings',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST - Dismiss an alert
export async function POST(request: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's team
    const teams = await (user as any).listTeams?.() || [];
    const selectedTeam = (user as any).selectedTeam || teams[0];

    if (!selectedTeam) {
      return NextResponse.json({ error: 'User does not belong to a team' }, { status: 400 });
    }

    // Check if user has permission
    const hasWritePermission = await (user as any).hasPermission?.(selectedTeam, 'write:teams') || false;
    if (!hasWritePermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get team slug
    const teamId = selectedTeam.id;
    const teamName = selectedTeam.displayName || 'Team';
    const { teamSlug } = await ensureTeamExists(teamId, teamName, 'Cost Analytics POST');

    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    // Verify the alert belongs to this team
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM projectnexus.ai_budget_alerts WHERE id = $1 AND team_slug = $2 AND dismissed_at IS NULL`,
      [alertId, teamSlug]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Alert not found or already dismissed' }, { status: 404 });
    }

    // Dismiss the alert
    await query(
      `UPDATE projectnexus.ai_budget_alerts SET dismissed_at = NOW() WHERE id = $1`,
      [alertId]
    );

    return NextResponse.json({
      success: true,
      message: 'Alert dismissed',
    });

  } catch (error) {
    console.error('❌ [Cost Analytics POST] Error:', error);
    console.error('❌ [Cost Analytics POST] Stack trace:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      success: false,
      error: 'Failed to dismiss alert',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
