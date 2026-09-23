/**
 * Migrate existing audit logs to §203 StGB immutable audit logs
 *
 * This script migrates historical audit logs from the standard audit_logs table
 * to the new §203 StGB immutable audit logs table with cryptographic chaining.
 *
 * Usage:
 *   npx tsx lib/audit/migrate-to-stgb203.ts
 */

import { createHash as createNodeHash } from 'crypto';
import { query } from '../db';

// Initial hash for the chain (genesis block)
const INITIAL_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Create a cryptographic hash of the audit log entry
 */
function createHash(data: Record<string, unknown>): string {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  return createNodeHash('sha256').update(dataString).digest('hex');
}

/**
 * Get the current last hash in the §203 StGB table
 */
async function getCurrentLastHash(): Promise<string> {
  try {
    const result = await query(
      `SELECT current_hash
       FROM projectnexus.stgb203_immutable_audit_logs
       ORDER BY timestamp DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return INITIAL_HASH;
    }

    return result.rows[0].current_hash;
  } catch (error) {
    console.error('[Migration] Error getting current last hash:', error);
    return INITIAL_HASH;
  }
}

/**
 * Migrate a single batch of audit logs
 */
async function migrateBatch(
  logs: unknown[],
  startHash: string
): Promise<{ migrated: number; lastHash: string; errors: number }> {
  let migrated = 0;
  let errors = 0;
  let currentHash = startHash;

  for (const log of logs as Array<Record<string, unknown>>) {
    try {
      // Map old audit log structure to new §203 StGB structure
      const action = String(log.action || 'unknown');
      const newLog = {
        timestamp: log.created_at || new Date().toISOString(),
        userId: String(log.actor_user_id || log.user_id || 'system'),
        action: action,
        resourceType: determineResourceType(action),
        resourceId: String(log.resource_id || log.id?.toString() || 'unknown'),
        accessType: determineAccessType(action),
        legalPrivilege: false, // Will be updated based on resource classification
        matterNumber: null, // Will be updated based on resource metadata
        ipAddress: log.ip_address ? String(log.ip_address) : null,
        userAgent: log.user_agent ? String(log.user_agent) : null,
        success: log.status !== 'failed',
        details: {
          originalAuditLogId: log.id,
          teamSlug: log.team_slug,
          metadata: log.metadata || {}
        }
      };

      // Create hash for this entry
      const entryHash = createHash({
        ...newLog,
        prevHash: currentHash
      });

      // Insert into immutable table
      await query(
        `INSERT INTO projectnexus.stgb203_immutable_audit_logs
         (prev_hash, current_hash, timestamp, user_id, action, resource_type, resource_id,
          access_type, legal_privilege, matter_number, ip_address, user_agent, success, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          currentHash,
          entryHash,
          newLog.timestamp,
          newLog.userId,
          newLog.action,
          newLog.resourceType,
          newLog.resourceId,
          newLog.accessType,
          newLog.legalPrivilege,
          newLog.matterNumber,
          newLog.ipAddress,
          newLog.userAgent,
          newLog.success,
          JSON.stringify(newLog.details)
        ]
      );

      currentHash = entryHash;
      migrated++;
    } catch (error) {
      console.error(`[Migration] Error migrating log ${log.id}:`, error);
      errors++;
    }
  }

  return { migrated, lastHash: currentHash, errors };
}

/**
 * Determine resource type from action
 */
function determineResourceType(action: string): string {
  const actionLower = action.toLowerCase();

  if (actionLower.includes('document') || actionLower.includes('file')) {
    return 'legal_document';
  }
  if (actionLower.includes('rag') || actionLower.includes('package')) {
    return 'rag_document';
  }
  if (actionLower.includes('chat') || actionLower.includes('message') || actionLower.includes('conversation')) {
    return 'conversation';
  }
  if (actionLower.includes('team') || actionLower.includes('member')) {
    return 'case_file';
  }

  return 'other';
}

/**
 * Determine access type from action
 */
function determineAccessType(action: string): string {
  const actionLower = action.toLowerCase();

  if (actionLower.includes('create') || actionLower.includes('upload') || actionLower.includes('add')) {
    return 'create';
  }
  if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
    return 'update';
  }
  if (actionLower.includes('delete') || actionLower.includes('remove')) {
    return 'delete';
  }
  if (actionLower.includes('export') || actionLower.includes('download')) {
    return 'export';
  }
  if (actionLower.includes('share') || actionLower.includes('invite')) {
    return 'share';
  }
  if (actionLower.includes('view') || actionLower.includes('read') || actionLower.includes('get')) {
    return 'view';
  }

  return 'view';
}

/**
 * Main migration function
 */
export async function migrateAuditLogsToStGB203(options: {
  batchSize?: number;
  dryRun?: boolean;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<{
  totalMigrated: number;
  totalErrors: number;
  batchesProcessed: number;
  duration: number;
}> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 1000;
  const dryRun = options.dryRun || false;

  console.log('[Migration] Starting §203 StGB audit log migration...');
  console.log(`[Migration] Batch size: ${batchSize}`);
  console.log(`[Migration] Dry run: ${dryRun}`);

  // Get current last hash in §203 StGB table
  let currentHash = await getCurrentLastHash();
  console.log(`[Migration] Starting hash: ${currentHash}`);

  let totalMigrated = 0;
  let totalErrors = 0;
  let batchesProcessed = 0;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Build query with date filters if provided
    let whereClause = '';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate.toISOString());
      paramIndex++;
    }

    if (options.endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate.toISOString());
      paramIndex++;
    }

    // Get batch of logs from old table
    const logsResult = await query(
      `SELECT *
       FROM projectnexus.audit_logs
       WHERE 1=1 ${whereClause}
       ORDER BY created_at ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, batchSize, offset]
    );

    if (logsResult.rows.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`[Migration] Processing batch ${batchesProcessed + 1} (${logsResult.rows.length} logs)...`);

    if (dryRun) {
      console.log(`[Migration] [DRY RUN] Would migrate ${logsResult.rows.length} logs`);
      totalMigrated += logsResult.rows.length;
    } else {
      // Migrate batch
      const result = await migrateBatch(logsResult.rows, currentHash);
      totalMigrated += result.migrated;
      totalErrors += result.errors;
      currentHash = result.lastHash;

      console.log(`[Migration] Batch ${batchesProcessed + 1} completed: ${result.migrated} migrated, ${result.errors} errors`);
    }

    batchesProcessed++;
    offset += batchSize;

    // Check if we have more logs
    if (logsResult.rows.length < batchSize) {
      hasMore = false;
    }
  }

  const duration = Date.now() - startTime;

  console.log('[Migration] Migration completed!');
  console.log(`[Migration] Total migrated: ${totalMigrated}`);
  console.log(`[Migration] Total errors: ${totalErrors}`);
  console.log(`[Migration] Batches processed: ${batchesProcessed}`);
  console.log(`[Migration] Duration: ${duration}ms`);
  console.log(`[Migration] Final hash: ${currentHash}`);

  return {
    totalMigrated,
    totalErrors,
    batchesProcessed,
    duration
  };
}

/**
 * Verify migration integrity
 */
export async function verifyMigration(): Promise<{
  valid: boolean;
  oldLogsCount: number;
  newLogsCount: number;
  gapCount: number;
}> {
  try {
    // Count logs in old table
    const oldResult = await query(
      `SELECT COUNT(*) as count FROM projectnexus.audit_logs`
    );
    const oldLogsCount = parseInt(oldResult.rows[0]?.count || '0');

    // Count logs in new table
    const newResult = await query(
      `SELECT COUNT(*) as count FROM projectnexus.stgb203_immutable_audit_logs`
    );
    const newLogsCount = parseInt(newResult.rows[0]?.count || '0');

    // Check for gaps (should be minimal if migration was successful)
    const gapResult = await query(`
      WITH time_gaps AS (
        SELECT
          timestamp,
          LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
        FROM projectnexus.stgb203_immutable_audit_logs
      )
      SELECT COUNT(*) as gap_count
      FROM time_gaps
      WHERE prev_timestamp IS NOT NULL
        AND EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) > 300
    `);
    const gapCount = parseInt(gapResult.rows[0]?.gap_count || '0');

    return {
      valid: newLogsCount >= oldLogsCount,
      oldLogsCount,
      newLogsCount,
      gapCount
    };
  } catch (error) {
    console.error('[Migration] Error verifying migration:', error);
    return {
      valid: false,
      oldLogsCount: 0,
      newLogsCount: 0,
      gapCount: 0
    };
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 1000;

  migrateAuditLogsToStGB203({ batchSize, dryRun })
    .then(() => {
      console.log('[Migration] ✅ Migration script completed');
      return verifyMigration();
    })
    .then((verification) => {
      console.log('[Migration] Verification:', verification);
      process.exit(verification.valid ? 0 : 1);
    })
    .catch((error) => {
      console.error('[Migration] ❌ Migration failed:', error);
      process.exit(1);
    });
}
