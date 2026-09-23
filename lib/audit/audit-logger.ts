/**
 * Audit Logger for GDPR and compliance events
 * Logs events to the audit_logs table in PostgreSQL
 */

import { query } from '@/lib/db';

export interface AuditEvent {
  action: string;
  userId?: string;
  teamSlug?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await query(
      `INSERT INTO projectnexus.audit_logs (
        id, team_slug, actor_user_id, action, target_type, target_id, metadata, created_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
      [
        event.teamSlug || null,
        event.userId || null,
        event.action,
        event.targetType || null,
        event.targetId || null,
        event.metadata ? JSON.stringify(event.metadata) : '{}',
      ]
    );
  } catch (error) {
    // Don't throw - logging failures shouldn't break the application
    console.error('Failed to log audit event:', error);
  }
}
