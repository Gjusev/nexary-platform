/**
 * Data Retention Policy Scheduler
 *
 * Implements automated data retention and deletion based on configurable policies.
 * Complies with SOC 2, GDPR, and other compliance frameworks.
 */

import { query } from '@/lib/db';

// =====================================================
// TYPES
// =====================================================

export interface RetentionPolicy {
  id: string;
  teamSlug: string | null;
  resourceType: 'chat_messages' | 'documents' | 'audit_logs' | 'api_keys' | 'consents' | 'scim_logs';
  retentionPeriodDays: number;
  actionAfterRetention: 'delete' | 'archive' | 'anonymize';
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionJob {
  id: string;
  policyId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;
  recordsAffected: number;
  errorMessage?: string;
}

export interface RetentionSummary {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalRecordsDeleted: number;
  oldestPendingDate: Date | null;
}

// =====================================================
// POLICY MANAGEMENT
// =====================================================

/**
 * Create a new retention policy
 */
export async function createRetentionPolicy(policy: {
  teamSlug?: string | null;
  resourceType: RetentionPolicy['resourceType'];
  retentionPeriodDays: number;
  actionAfterRetention: RetentionPolicy['actionAfterRetention'];
}): Promise<RetentionPolicy> {
  const result = await query(
    `INSERT INTO projectnexus.retention_policies (
      id, team_slug, resource_type, retention_period_days, action_after_retention, created_at, updated_at
    ) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
    RETURNING *`,
    [policy.teamSlug || null, policy.resourceType, policy.retentionPeriodDays, policy.actionAfterRetention]
  );

  return result.rows[0];
}

/**
 * Get retention policies for a team or global policies
 */
export async function getRetentionPolicies(teamSlug?: string): Promise<RetentionPolicy[]> {
  const result = await query(
    `SELECT * FROM projectnexus.retention_policies
     WHERE ($1::text IS NULL OR team_slug = $1 OR team_slug IS NULL)
     ORDER BY team_slug NULLS LAST, resource_type`,
    [teamSlug || null]
  );

  return result.rows.map((row) => ({
    id: row.id,
    teamSlug: row.team_slug,
    resourceType: row.resource_type,
    retentionPeriodDays: parseInt(row.retention_period_days),
    actionAfterRetention: row.action_after_retention,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Update a retention policy
 */
export async function updateRetentionPolicy(
  policyId: string,
  updates: Partial<Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<RetentionPolicy | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.teamSlug !== undefined) {
    fields.push(`team_slug = $${paramIndex}`);
    values.push(updates.teamSlug);
    paramIndex++;
  }

  if (updates.resourceType !== undefined) {
    fields.push(`resource_type = $${paramIndex}`);
    values.push(updates.resourceType);
    paramIndex++;
  }

  if (updates.retentionPeriodDays !== undefined) {
    fields.push(`retention_period_days = $${paramIndex}`);
    values.push(updates.retentionPeriodDays);
    paramIndex++;
  }

  if (updates.actionAfterRetention !== undefined) {
    fields.push(`action_after_retention = $${paramIndex}`);
    values.push(updates.actionAfterRetention);
    paramIndex++;
  }

  fields.push(`updated_at = NOW()`);

  values.push(policyId);

  const result = await query(
    `UPDATE projectnexus.retention_policies
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Delete a retention policy
 */
export async function deleteRetentionPolicy(policyId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM projectnexus.retention_policies WHERE id = $1 RETURNING id`,
    [policyId]
  );

  return (result.rowCount || 0) > 0;
}

// =====================================================
// RETENTION PROCESSING
// =====================================================

/**
 * Process retention policies and create jobs
 */
export async function scheduleRetentionJobs(): Promise<number> {
  // Get all active policies
  const policies = await getRetentionPolicies();

  let jobsCreated = 0;

  for (const policy of policies) {
    // Check if there's already a pending job for this policy
    const existingJob = await query(
      `SELECT id FROM projectnexus.retention_jobs
       WHERE policy_id = $1
         AND status = 'pending'
         AND scheduled_for <= NOW()
       LIMIT 1`,
      [policy.id]
    );

    if (existingJob.rows.length > 0) {
      continue; // Job already exists
    }

    // Create a new job
    await query(
      `INSERT INTO projectnexus.retention_jobs (id, policy_id, status, scheduled_for)
       VALUES (gen_random_uuid(), $1, 'pending', NOW())`,
      [policy.id]
    );

    jobsCreated++;
  }

  return jobsCreated;
}

/**
 * Process pending retention jobs
 */
export async function processPendingJobs(): Promise<RetentionJob[]> {
  // Get pending jobs
  const jobsResult = await query(
    `SELECT * FROM projectnexus.retention_jobs
     WHERE status = 'pending'
       AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT 10`
  );

  const processedJobs: RetentionJob[] = [];

  for (const job of jobsResult.rows) {
    const result = await processJob(job.id);
    if (result) {
      processedJobs.push(result);
    }
  }

  return processedJobs;
}

/**
 * Process a single retention job
 */
async function processJob(jobId: string): Promise<RetentionJob | null> {
  try {
    // Mark as in progress
    await query(
      `UPDATE projectnexus.retention_jobs
       SET status = 'in_progress', started_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    // Get job with policy details
    const jobResult = await query(
      `SELECT
         rj.id,
         rj.policy_id,
         rp.resource_type,
         rp.retention_period_days,
         rp.action_after_retention,
         rp.team_slug
       FROM projectnexus.retention_jobs rj
       JOIN projectnexus.retention_policies rp ON rp.id = rj.policy_id
       WHERE rj.id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobResult.rows[0];
    let recordsAffected = 0;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - job.retention_period_days);

    // Process based on resource type
    switch (job.resource_type) {
      case 'chat_messages':
        recordsAffected = await processChatMessages(cutoffDate, job.action_after_retention, job.team_slug);
        break;

      case 'documents':
        recordsAffected = await processDocuments(cutoffDate, job.action_after_retention, job.team_slug);
        break;

      case 'audit_logs':
        recordsAffected = await processAuditLogs(cutoffDate, job.action_after_retention, job.team_slug);
        break;

      case 'api_keys':
        recordsAffected = await processApiKeys(cutoffDate, job.action_after_retention, job.team_slug);
        break;

      case 'consents':
        recordsAffected = await processConsents(cutoffDate, job.action_after_retention, job.team_slug);
        break;

      default:
        throw new Error(`Unknown resource type: ${job.resource_type}`);
    }

    // Mark as completed
    await query(
      `UPDATE projectnexus.retention_jobs
       SET status = 'completed', completed_at = NOW(), records_affected = $2
       WHERE id = $1`,
      [jobId, recordsAffected]
    );

    // Return updated job
    const updatedResult = await query(
      `SELECT * FROM projectnexus.retention_jobs WHERE id = $1`,
      [jobId]
    );

    return mapJobRow(updatedResult.rows[0]);
  } catch (error) {
    // Mark as failed
    await query(
      `UPDATE projectnexus.retention_jobs
       SET status = 'failed', completed_at = NOW(), error_message = $2
       WHERE id = $1`,
      [jobId, error instanceof Error ? error.message : 'Unknown error']
    );

    return null;
  }
}

// =====================================================
// RESOURCE PROCESSING
// =====================================================

async function processChatMessages(
  cutoffDate: Date,
  action: string,
  teamSlug: string | null
): Promise<number> {
  if (action === 'delete') {
    const result = await query(
      `DELETE FROM projectnexus.chat_messages
       WHERE created_at < $1
         AND ($2::text IS NULL OR conversation_id IN (
           SELECT id FROM projectnexus.chat_conversations WHERE team_slug = $2
         ))`,
      [cutoffDate.toISOString(), teamSlug]
    );
    return result.rowCount || 0;
  }

  // For anonymize or archive, implement as needed
  return 0;
}

async function processDocuments(
  cutoffDate: Date,
  action: string,
  teamSlug: string | null
): Promise<number> {
  if (action === 'delete') {
    const result = await query(
      `DELETE FROM projectnexus.rag_documents
       WHERE created_at < $1
         AND ($2::text IS NULL OR team_slug = $2)`,
      [cutoffDate.toISOString(), teamSlug]
    );
    return result.rowCount || 0;
  }

  return 0;
}

async function processAuditLogs(
  cutoffDate: Date,
  action: string,
  teamSlug: string | null
): Promise<number> {
  if (action === 'delete') {
    const result = await query(
      `DELETE FROM projectnexus.audit_logs
       WHERE created_at < $1
         AND ($2::text IS NULL OR team_slug = $2)`,
      [cutoffDate.toISOString(), teamSlug]
    );
    return result.rowCount || 0;
  }

  return 0;
}

async function processApiKeys(
  cutoffDate: Date,
  action: string,
  teamSlug: string | null
): Promise<number> {
  if (action === 'delete') {
    const result = await query(
      `DELETE FROM projectnexus.api_keys
       WHERE created_at < $1
         AND ($2::text IS NULL OR team_slug = $2)`,
      [cutoffDate.toISOString(), teamSlug]
    );
    return result.rowCount || 0;
  }

  return 0;
}

async function processConsents(
  cutoffDate: Date,
  action: string,
  teamSlug: string | null
): Promise<number> {
  // Consents have special handling - only revoke, don't delete
  if (action === 'anonymize') {
    const result = await query(
      `UPDATE projectnexus.consent_records
       SET withdrawn_at = NOW()
       WHERE granted_at < $1
         AND withdrawn_at IS NULL`,
      [cutoffDate.toISOString()]
    );
    return result.rowCount || 0;
  }

  return 0;
}

// =====================================================
// JOB MANAGEMENT
// =====================================================

/**
 * Get retention jobs
 */
export async function getRetentionJobs(filters: {
  teamSlug?: string;
  status?: string;
  limit?: number;
} = {}): Promise<RetentionJob[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (filters.teamSlug) {
    conditions.push(`rp.team_slug = $${paramIndex}`);
    values.push(filters.teamSlug);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`rj.status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';

  const result = await query(
    `SELECT
       rj.id,
       rj.policy_id,
       rj.status,
       rj.scheduled_for,
       rj.started_at,
       rj.completed_at,
       rj.records_affected,
       rj.error_message
     FROM projectnexus.retention_jobs rj
     JOIN projectnexus.retention_policies rp ON rp.id = rj.policy_id
     ${whereClause}
     ORDER BY rj.scheduled_for DESC
     ${limitClause}`,
    values
  );

  return result.rows.map(mapJobRow);
}

/**
 * Get retention summary
 */
export async function getRetentionSummary(teamSlug?: string): Promise<RetentionSummary> {
  const teamFilter = teamSlug
    ? `WHERE policy_id IN (SELECT id FROM projectnexus.retention_policies WHERE team_slug = $1 OR team_slug IS NULL)`
    : '';

  const result = await query(
    `SELECT
       COUNT(*) as total_jobs,
       COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
       COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
       COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
       COALESCE(SUM(records_affected), 0) as total_records_deleted,
       MIN(scheduled_for) FILTER (WHERE status = 'pending') as oldest_pending_date
     FROM projectnexus.retention_jobs
     ${teamFilter}`,
    teamSlug ? [teamSlug] : []
  );

  const row = result.rows[0];

  return {
    totalJobs: parseInt(row.total_jobs),
    pendingJobs: parseInt(row.pending_jobs),
    completedJobs: parseInt(row.completed_jobs),
    failedJobs: parseInt(row.failed_jobs),
    totalRecordsDeleted: parseInt(row.total_records_deleted),
    oldestPendingDate: row.oldest_pending_date ? new Date(row.oldest_pending_date) : null,
  };
}

function mapJobRow(row: any): RetentionJob {
  return {
    id: row.id,
    policyId: row.policy_id,
    status: row.status,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    recordsAffected: parseInt(row.records_affected || 0),
    errorMessage: row.error_message,
  };
}
