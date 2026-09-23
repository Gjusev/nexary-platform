import { query } from '@/lib/db';
import { headers } from 'next/headers';

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'REGISTER'
    | 'CHAT_QUERY'
    | 'DOCUMENT_UPLOAD'
    | 'DOCUMENT_DELETE'
    | 'TEAM_INVITE_CREATE'
    | 'TEAM_INVITE_ACCEPT'
    | 'SETTINGS_UPDATE';

export interface AuditLogParams {
    action: AuditAction;
    userId?: string;
    teamSlug?: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Logs a user action to the database for compliance and auditing.
 * Safe to await, but catches errors to prevent blocking the main flow.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        // Try to get headers if not provided (works in Server Components/Actions)
        let ip = params.ipAddress;
        let ua = params.userAgent;

        if (!ip || !ua) {
            try {
                const headersList = await headers();
                if (!ip) ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown';
                if (!ua) ua = headersList.get('user-agent') || 'unknown';
            } catch (e) {
                // Headers might not be available in all contexts (e.g. background jobs)
            }
        }

        await query(
            `INSERT INTO projectnexus.audit_logs 
       (actor_user_id, team_slug, action, target_type, target_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                params.userId || null,
                params.teamSlug || null,
                params.action,
                params.targetType || null,
                params.targetId || null,
                ip,
                ua,
                JSON.stringify(params.metadata || {})
            ]
        );
    } catch (error) {
        console.error('Failed to write audit log:', error);
        // We intentionally do not throw here to avoid breaking the user flow
        // In a strict environment, we might want to throw or use a fallback logger
    }
}
