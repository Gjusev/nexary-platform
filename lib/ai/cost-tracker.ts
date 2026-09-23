/**
 * AI Cost Tracker Service
 *
 * Tracks AI model usage, costs, and provides budget alerts.
 *
 * Pricing data (as of 2025):
 * - OpenAI GPT-4o: $0.005/1M input, $0.015/1K output
 * - OpenAI GPT-4o-mini: $0.00015/1M input, $0.0006/1K output
 * - Anthropic Claude 3.5 Sonnet: $0.003/1M input, $0.015/1K output
 * - Anthropic Claude 3 Haiku: $0.00025/1M input, $0.00125/1K output
 * - Gemini 1.5 Pro: $0.00125/1M input, $0.005/1K output
 */

import { query } from '@/lib/db';

export interface ModelPricing {
  inputCostPer1M: number; // USD per 1M input tokens
  outputCostPer1M: number; // USD per 1M output tokens
}

// Default pricing per model (as of 2025)
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-5.2': { inputCostPer1M: 0.01, outputCostPer1M: 0.05 },
  'gpt-5.2-pro': { inputCostPer1M: 0.015, outputCostPer1M: 0.075 },
  'gpt-5': { inputCostPer1M: 0.005, outputCostPer1M: 0.025 },
  'gpt-5-mini': { inputCostPer1M: 0.00015, outputCostPer1M: 0.0006 },
  'o1-preview': { inputCostPer1M: 0.015, outputCostPer1M: 0.06 },
  'o1-mini': { inputCostPer1M: 0.003, outputCostPer1M: 0.012 },
  'gpt-4o': { inputCostPer1M: 0.005, outputCostPer1M: 0.015 },
  'gpt-4o-mini': { inputCostPer1M: 0.00015, outputCostPer1M: 0.0006 },
  'gpt-4-turbo': { inputCostPer1M: 0.01, outputCostPer1M: 0.03 },
  'gpt-3.5-turbo': { inputCostPer1M: 0.0005, outputCostPer1M: 0.0015 },

  // Anthropic
  'claude-3-5-sonnet-20241022': { inputCostPer1M: 0.003, outputCostPer1M: 0.015 },
  'claude-3-5-sonnet-20240620': { inputCostPer1M: 0.003, outputCostPer1M: 0.015 },
  'claude-3-opus-20240229': { inputCostPer1M: 0.015, outputCostPer1M: 0.075 },
  'claude-3-sonnet-20240229': { inputCostPer1M: 0.003, outputCostPer1M: 0.015 },
  'claude-3-haiku-20240307': { inputCostPer1M: 0.00025, outputCostPer1M: 0.00125 },
  'claude-3-5-haiku-20241022': { inputCostPer1M: 0.0008, outputCostPer1M: 0.004 },

  // Google Gemini
  'gemini-2.0-flash-exp': { inputCostPer1M: 0.00125, outputCostPer1M: 0.005 },
  'gemini-1.5-pro': { inputCostPer1M: 0.00125, outputCostPer1M: 0.005 },
  'gemini-1.5-flash': { inputCostPer1M: 0.000075, outputCostPer1M: 0.0003 },

  // Mistral
  'mistral-large': { inputCostPer1M: 0.004, outputCostPer1M: 0.012 },
  'mistral-medium': { inputCostPer1M: 0.00025, outputCostPer1M: 0.00025 },
  'codestral': { inputCostPer1M: 0.003, outputCostPer1M: 0.003 },

  // Aleph Alpha
  'luminous-supreme': { inputCostPer1M: 0.02, outputCostPer1M: 0.02 },
  'luminous-extended': { inputCostPer1M: 0.005, outputCostPer1M: 0.005 },
};

export interface UsageLogInput {
  teamSlug: string;
  userEmail: string;
  conversationId?: string;
  messageId?: string;
  provider: string;
  model: string;
  requestTokens: number;
  responseTokens: number;
  featuresUsed?: string[];
  responseTimeMs?: number;
  timeToFirstTokenMs?: number;
  errorMessage?: string;
}

export interface UsageLog {
  id: string;
  teamSlug: string;
  userEmail: string;
  conversationId?: string;
  messageId?: string;
  provider: string;
  model: string;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  featuresUsed: string[];
  responseTimeMs?: number;
  timeToFirstTokenMs?: number;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Calculate cost for a request based on model and tokens
 */
export function calculateCost(
  provider: string,
  model: string,
  requestTokens: number,
  responseTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  // Check for custom pricing in team settings
  const pricing = DEFAULT_MODEL_PRICING[model] || DEFAULT_MODEL_PRICING['gpt-4o'];

  const inputCost = (requestTokens / 1_000_000) * pricing.inputCostPer1M;
  const outputCost = (responseTokens / 1_000_000) * pricing.outputCostPer1M;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

/**
 * Log AI usage and update team spend
 */
export async function logAiUsage(input: UsageLogInput): Promise<UsageLog> {
  const { inputCost, outputCost, totalCost } = calculateCost(
    input.provider,
    input.model,
    input.requestTokens,
    input.responseTokens
  );

  // Insert usage log
  const { rows } = await query<{
    id: string;
    team_slug: string;
    user_email: string;
    conversation_id: string;
    message_id: string;
    provider: string;
    model: string;
    request_tokens: number;
    response_tokens: number;
    total_tokens: number;
    input_cost_usd: string; // NUMERIC type returns string in node-postgres
    output_cost_usd: string; // NUMERIC type returns string in node-postgres
    total_cost_usd: string; // NUMERIC type returns string in node-postgres
    features_used: string[];
    response_time_ms: number;
    time_to_first_token_ms: number;
    error_message: string;
    created_at: Date;
  }>(
    `INSERT INTO projectnexus.ai_usage_logs (
      id, team_slug, user_email, conversation_id, message_id,
      provider, model, request_tokens, response_tokens, total_tokens,
      input_cost_usd, output_cost_usd, total_cost_usd,
      features_used, response_time_ms, time_to_first_token_ms, error_message, created_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
    )
    RETURNING *`,
    [
      input.teamSlug,
      input.userEmail,
      input.conversationId || null,
      input.messageId || null,
      input.provider,
      input.model,
      input.requestTokens,
      input.responseTokens,
      input.requestTokens + input.responseTokens,
      inputCost,
      outputCost,
      totalCost,
      input.featuresUsed || [],
      input.responseTimeMs || null,
      input.timeToFirstTokenMs || null,
      input.errorMessage || null,
    ]
  );

  const row = rows[0];

  // Update team's monthly spend
  await updateTeamMonthlySpend(input.teamSlug, totalCost);

  // Check for budget alerts
  await checkBudgetAlerts(input.teamSlug);

  return {
    id: row.id,
    teamSlug: row.team_slug,
    userEmail: row.user_email,
    conversationId: row.conversation_id || undefined,
    messageId: row.message_id || undefined,
    provider: row.provider,
    model: row.model,
    requestTokens: row.request_tokens,
    responseTokens: row.response_tokens,
    totalTokens: row.total_tokens,
    inputCostUsd: parseFloat(row.input_cost_usd),
    outputCostUsd: parseFloat(row.output_cost_usd),
    totalCostUsd: parseFloat(row.total_cost_usd),
    featuresUsed: row.features_used,
    responseTimeMs: row.response_time_ms || undefined,
    timeToFirstTokenMs: row.time_to_first_token_ms || undefined,
    errorMessage: row.error_message || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Update team's monthly spend
 */
async function updateTeamMonthlySpend(teamSlug: string, costUsd: number): Promise<void> {
  // Use upsert to ensure settings exist
  await query(
    `INSERT INTO projectnexus.ai_cost_settings (team_slug, current_monthly_spend_usd, current_month_start_date)
     VALUES ($1, $2, DATE_TRUNC('month', CURRENT_DATE))
     ON CONFLICT (team_slug) DO UPDATE SET
       current_monthly_spend_usd = ai_cost_settings.current_monthly_spend_usd + $2,
       updated_at = NOW()`,
    [teamSlug, costUsd]
  );
}

/**
 * Check if budget alerts should be triggered
 */
async function checkBudgetAlerts(teamSlug: string): Promise<void> {
  const { rows } = await query<{
    monthly_budget_usd: number;
    current_monthly_spend_usd: number;
    alert_threshold_percentage: number;
  }>(
    `SELECT monthly_budget_usd, current_monthly_spend_usd, alert_threshold_percentage
     FROM projectnexus.ai_cost_settings
     WHERE team_slug = $1`,
    [teamSlug]
  );

  if (rows.length === 0 || !rows[0].monthly_budget_usd) {
    return; // No budget set
  }

  const budget = rows[0].monthly_budget_usd;
  const spend = rows[0].current_monthly_spend_usd;
  const threshold = rows[0].alert_threshold_percentage;

  const percentageUsed = (spend / budget) * 100;

  // Check if we should trigger an alert (only if not recently dismissed)
  if (percentageUsed >= threshold) {
    const { rows: recentAlerts } = await query<{
      id: string;
      created_at: Date;
    }>(
      `SELECT id FROM projectnexus.ai_budget_alerts
       WHERE team_slug = $1
         AND alert_type = 'threshold_reached'
         AND dismissed_at IS NULL
         AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC
       LIMIT 1`,
      [teamSlug]
    );

    // Only create alert if none in the last hour
    if (recentAlerts.length === 0) {
      await query(
        `INSERT INTO projectnexus.ai_budget_alerts (
          id, team_slug, alert_type, percentage_used, monthly_spend_usd, budget_usd, created_at
        )
        VALUES (
          gen_random_uuid(), $1, 'threshold_reached', $2, $3, $4, NOW()
        )`,
        [teamSlug, Math.round(percentageUsed), spend, budget]
      );
    }
  }
}

/**
 * Get cost analytics for a team
 */
export async function getCostAnalytics(teamSlug: string, days: number = 30): Promise<{
  totalSpend: number;
  totalRequests: number;
  totalTokens: number;
  byProvider: Array<{ provider: string; spend: number; requests: number }>;
  byModel: Array<{ model: string; provider: string; spend: number; requests: number; avgTokens: number }>;
  dailySpend: Array<{ date: string; spend: number; requests: number }>;
}> {
  const { rows } = await query<{
    total_spend: string; // NUMERIC returns string in node-postgres
    total_requests: number;
    total_tokens: number;
  }>(
    `SELECT
      COALESCE(SUM(total_cost_usd), 0) as total_spend,
      COUNT(*) as total_requests,
      COALESCE(SUM(total_tokens), 0) as total_tokens
    FROM projectnexus.ai_usage_logs
    WHERE team_slug = $1
      AND created_at >= NOW() - INTERVAL '${days} days'`,
    [teamSlug]
  );

  const summary = rows[0];

  // By provider
  const { rows: byProviderRows } = await query<{
    provider: string;
    spend: string; // NUMERIC returns string in node-postgres
    requests: number;
  }>(
    `SELECT
      provider,
      COALESCE(SUM(total_cost_usd), 0) as spend,
      COUNT(*) as requests
    FROM projectnexus.ai_usage_logs
    WHERE team_slug = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY provider
    ORDER BY spend DESC`,
    [teamSlug]
  );

  // By model
  const { rows: byModelRows } = await query<{
    model: string;
    provider: string;
    spend: string; // NUMERIC returns string in node-postgres
    requests: number;
    avg_tokens: number;
  }>(
    `SELECT
      model,
      provider,
      COALESCE(SUM(total_cost_usd), 0) as spend,
      COUNT(*) as requests,
      COALESCE(AVG(total_tokens), 0) as avg_tokens
    FROM projectnexus.ai_usage_logs
    WHERE team_slug = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY model, provider
    ORDER BY spend DESC`,
    [teamSlug]
  );

  // Daily spend
  const { rows: dailyRows } = await query<{
    date: string;
    spend: string; // NUMERIC returns string in node-postgres
    requests: number;
  }>(
    `SELECT
      DATE(created_at) as date,
      COALESCE(SUM(total_cost_usd), 0) as spend,
      COUNT(*) as requests
    FROM projectnexus.ai_usage_logs
    WHERE team_slug = $1
      AND created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC`,
    [teamSlug]
  );

  // Map results to correct format (convert string NUMERIC to number)
  const byModel = byModelRows.map(row => ({
    model: row.model,
    provider: row.provider,
    spend: parseFloat(row.spend),
    requests: row.requests,
    avgTokens: row.avg_tokens,
  }));

  const byProvider = byProviderRows.map(row => ({
    provider: row.provider,
    spend: parseFloat(row.spend),
    requests: row.requests,
  }));

  const dailySpend = dailyRows.map(row => ({
    date: row.date,
    spend: parseFloat(row.spend),
    requests: row.requests,
  }));

  return {
    totalSpend: parseFloat(summary.total_spend),
    totalRequests: summary.total_requests,
    totalTokens: summary.total_tokens,
    byProvider,
    byModel,
    dailySpend,
  };
}

/**
 * Get team cost settings
 */
export async function getCostSettings(teamSlug: string): Promise<{
  monthlyBudgetUsd?: number;
  currentMonthlySpendUsd: number;
  alertThresholdPercentage: number;
  currentMonthStartDate: Date;
} | null> {
  const { rows } = await query<{
    monthly_budget_usd: number;
    current_monthly_spend_usd: string; // NUMERIC returns string in node-postgres
    alert_threshold_percentage: number;
    current_month_start_date: Date;
  }>(
    `SELECT monthly_budget_usd, current_monthly_spend_usd, alert_threshold_percentage, current_month_start_date
     FROM projectnexus.ai_cost_settings
     WHERE team_slug = $1`,
    [teamSlug]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    monthlyBudgetUsd: row.monthly_budget_usd || undefined,
    currentMonthlySpendUsd: parseFloat(row.current_monthly_spend_usd),
    alertThresholdPercentage: row.alert_threshold_percentage,
    currentMonthStartDate: row.current_month_start_date,
  };
}

/**
 * Update cost settings for a team
 */
export async function updateCostSettings(
  teamSlug: string,
  settings: {
    monthlyBudgetUsd?: number;
    alertThresholdPercentage?: number;
  }
): Promise<void> {
  await query(
    `INSERT INTO projectnexus.ai_cost_settings (team_slug, monthly_budget_usd, alert_threshold_percentage)
     VALUES ($1, $2, $3)
     ON CONFLICT (team_slug) DO UPDATE SET
       monthly_budget_usd = COALESCE($2, ai_cost_settings.monthly_budget_usd),
       alert_threshold_percentage = COALESCE($3, ai_cost_settings.alert_threshold_percentage),
       updated_at = NOW()`,
    [teamSlug, settings.monthlyBudgetUsd || null, settings.alertThresholdPercentage || null]
  );
}
