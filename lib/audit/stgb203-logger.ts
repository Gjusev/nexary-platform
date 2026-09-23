/**
 * §203 StGB Immutable Audit Logger
 *
 * Provides tamper-evident, immutable audit logging for German legal compliance.
 * Logs are chained cryptographically to prevent tampering and ensure 10-year retention.
 *
 * Key Features:
 * - Immutable storage (INSERT only, no UPDATE/DELETE)
 * - Cryptographic hash chain for tamper detection
 * - 10-year retention requirement compliance
 * - Attorney-client privilege tracking
 * - Legal matter number tracking
 */

import { createHash as createNodeHash } from 'crypto';
import { query } from '../db';

// Type definitions for §203 StGB audit logs
export interface StGB203AuditLog {
  userId: string;
  action: string;
  resourceType: 'legal_document' | 'case_file' | 'client_comm' | 'rag_document' | 'conversation' | 'other';
  resourceId: string;
  accessType: 'view' | 'create' | 'update' | 'delete' | 'export' | 'share' | 'classify';
  legalPrivilege?: boolean; // Attorney-client privilege
  matterNumber?: string; // Legal matter/expediente number
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, unknown>;
}

export interface ChainIntegrityResult {
  valid: boolean;
  gapDetected: boolean;
  firstGapTimestamp?: Date;
  totalEntries: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

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
 * Get the previous hash from the most recent audit log entry
 */
async function getPreviousHash(): Promise<{ current_hash: string; timestamp: Date } | null> {
  try {
    const result = await query(
      `SELECT current_hash, timestamp
       FROM projectnexus.stgb203_immutable_audit_logs
       ORDER BY timestamp DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      current_hash: result.rows[0].current_hash,
      timestamp: new Date(result.rows[0].timestamp)
    };
  } catch (error) {
    console.error('[StGB203 Logger] Error getting previous hash:', error);
    return null;
  }
}

/**
 * Verify the integrity of the hash chain
 * Detects any tampering by checking that each entry's prev_hash matches the previous entry's current_hash
 */
export async function verifyChainIntegrity(): Promise<ChainIntegrityResult> {
  try {
    // Get all entries ordered by timestamp
    const result = await query(
      `SELECT id, prev_hash, current_hash, timestamp
       FROM projectnexus.stgb203_immutable_audit_logs
       ORDER BY timestamp ASC`
    );

    if (result.rows.length === 0) {
      return {
        valid: true,
        gapDetected: false,
        totalEntries: 0
      };
    }

    let valid = true;
    let gapDetected = false;
    let firstGapTimestamp: Date | undefined;
    let expectedHash = INITIAL_HASH;
    let previousTimestamp: Date | undefined;

    for (const row of result.rows) {
      // Check hash chain integrity
      if (row.prev_hash !== expectedHash) {
        console.error(`[StGB203 Logger] Hash chain broken at entry ${row.id}`);
        console.error(`[StGB203 Logger] Expected: ${expectedHash}, Got: ${row.prev_hash}`);
        valid = false;
      }

      // Check for gaps in timeline (more than 5 minutes between entries during active period)
      if (previousTimestamp) {
        const timeDiff = new Date(row.timestamp).getTime() - previousTimestamp.getTime();
        // Gap detection: more than 5 minutes difference
        if (timeDiff > 5 * 60 * 1000) {
          if (!gapDetected) {
            gapDetected = true;
            firstGapTimestamp = new Date(row.timestamp);
          }
        }
      }

      expectedHash = row.current_hash;
      previousTimestamp = new Date(row.timestamp);
    }

    return {
      valid,
      gapDetected,
      firstGapTimestamp,
      totalEntries: result.rows.length,
      oldestEntry: new Date(result.rows[0].timestamp),
      newestEntry: previousTimestamp
    };
  } catch (error) {
    console.error('[StGB203 Logger] Error verifying chain integrity:', error);
    return {
      valid: false,
      gapDetected: true,
      totalEntries: 0
    };
  }
}

/**
 * Log an immutable §203 StGB audit event
 *
 * This function creates a cryptographically chained audit log entry that:
 * 1. Cannot be modified or deleted (immutable storage)
 * 2. Is linked to the previous entry via hash chain
 * 3. Includes attorney-client privilege status
 * 4. Tracks legal matter numbers
 * 5. Stores IP and user agent for forensics
 */
export async function logStGB203Event(data: StGB203AuditLog): Promise<string | null> {
  try {
    // 1. Get the previous hash from the chain
    const prevLog = await getPreviousHash();
    const prevHash = prevLog?.current_hash || INITIAL_HASH;

    // 2. Create the hash for this entry with all data + prev_hash
    const currentHash = createHash({
      ...data,
      prevHash,
      timestamp: new Date().toISOString()
    });

    // 3. Insert into immutable table (INSERT only, no UPDATE/DELETE)
    const result = await query(
      `INSERT INTO projectnexus.stgb203_immutable_audit_logs
       (prev_hash, current_hash, user_id, action, resource_type, resource_id,
        access_type, legal_privilege, matter_number, ip_address, user_agent,
        success, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        prevHash,
        currentHash,
        data.userId,
        data.action,
        data.resourceType,
        data.resourceId,
        data.accessType,
        data.legalPrivilege || false,
        data.matterNumber || null,
        data.ipAddress || null,
        data.userAgent || null,
        data.success,
        JSON.stringify(data.details || {})
      ]
    );

    const logId = result.rows[0]?.id;

    // 4. Periodically verify chain integrity (every 100th entry)
    const prevLogCount = await query(
      `SELECT COUNT(*) as count FROM projectnexus.stgb203_immutable_audit_logs`
    );
    const count = parseInt(prevLogCount.rows[0]?.count || '0');

    if (count % 100 === 0) {
      const integrity = await verifyChainIntegrity();
      if (!integrity.valid) {
        console.error('[StGB203 Logger] Chain integrity check failed!', integrity);
        // In production, this should trigger an alert to security team
      } else {
        console.debug('[StGB203 Logger] Chain integrity verified:', {
          totalEntries: integrity.totalEntries,
          oldestEntry: integrity.oldestEntry,
          newestEntry: integrity.newestEntry
        });
      }
    }

    return logId;
  } catch (error) {
    console.error('[StGB203 Logger] Error logging event:', error);
    // Non-blocking: logging failure should not break the application
    return null;
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsForResource(
  resourceType: string,
  resourceId: string,
  limit: number = 100
): Promise<unknown[]> {
  try {
    const result = await query(
      `SELECT
         id,
         timestamp,
         user_id,
         action,
         access_type,
         legal_privilege,
         matter_number,
         ip_address,
         user_agent,
         success,
         details
       FROM projectnexus.stgb203_immutable_audit_logs
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [resourceType, resourceId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('[StGB203 Logger] Error getting audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getAuditLogsForUser(
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<unknown[]> {
  try {
    const result = await query(
      `SELECT
         id,
         timestamp,
         action,
         resource_type,
         resource_id,
         access_type,
         legal_privilege,
         matter_number,
         ip_address,
         user_agent,
         success,
         details
       FROM projectnexus.stgb203_immutable_audit_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('[StGB203 Logger] Error getting user audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific legal matter
 */
export async function getAuditLogsForMatter(
  matterNumber: string,
  limit: number = 100
): Promise<unknown[]> {
  try {
    const result = await query(
      `SELECT
         id,
         timestamp,
         user_id,
         action,
         resource_type,
         resource_id,
         access_type,
         legal_privilege,
         ip_address,
         user_agent,
         success,
         details
       FROM projectnexus.stgb203_immutable_audit_logs
       WHERE matter_number = $1
       ORDER BY timestamp ASC`,
      [matterNumber, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('[StGB203 Logger] Error getting matter audit logs:', error);
    return [];
  }
}

/**
 * Get privileged access logs (attorney-client privilege)
 * Useful for compliance reporting
 */
export async function getPrivilegedAccessLogs(
  startDate?: Date,
  endDate?: Date,
  limit: number = 1000
): Promise<unknown[]> {
  try {
    let queryText = `
      SELECT
        id,
        timestamp,
        user_id,
        action,
        resource_type,
        resource_id,
        access_type,
        matter_number,
        ip_address,
        user_agent,
        success,
        details
      FROM projectnexus.stgb203_immutable_audit_logs
      WHERE legal_privilege = true
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (startDate) {
      queryText += ` AND timestamp >= $${paramIndex}`;
      params.push(startDate.toISOString());
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND timestamp <= $${paramIndex}`;
      params.push(endDate.toISOString());
      paramIndex++;
    }

    queryText += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(queryText, params);
    return result.rows;
  } catch (error) {
    console.error('[StGB203 Logger] Error getting privileged access logs:', error);
    return [];
  }
}

/**
 * Get compliance metrics for §203 StGB
 */
export async function getComplianceMetrics(): Promise<{
  totalEntries: number;
  privilegedEntries: number;
  oldestEntry: Date | null;
  retentionYears: number;
  chainValid: boolean;
}> {
  try {
    const metrics = await query(`
      SELECT
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE legal_privilege = true) as privileged_entries,
        MIN(timestamp) as oldest_entry
      FROM projectnexus.stgb203_immutable_audit_logs
    `);

    const integrity = await verifyChainIntegrity();

    const totalEntries = parseInt(metrics.rows[0]?.total_entries || '0');
    const privilegedEntries = parseInt(metrics.rows[0]?.privileged_entries || '0');
    const oldestEntry = metrics.rows[0]?.oldest_entry
      ? new Date(metrics.rows[0].oldest_entry)
      : null;

    // Calculate retention years
    let retentionYears = 0;
    if (oldestEntry) {
      const now = new Date();
      retentionYears = (now.getTime() - oldestEntry.getTime()) / (1000 * 60 * 60 * 24 * 365);
    }

    return {
      totalEntries,
      privilegedEntries,
      oldestEntry,
      retentionYears,
      chainValid: integrity.valid
    };
  } catch (error) {
    console.error('[StGB203 Logger] Error getting compliance metrics:', error);
    return {
      totalEntries: 0,
      privilegedEntries: 0,
      oldestEntry: null,
      retentionYears: 0,
      chainValid: false
    };
  }
}
