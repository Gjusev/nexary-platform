/**
 * Audit Middleware
 *
 * Provides comprehensive audit logging for sensitive operations.
 * All audit logs are stored in the audit_logs table for compliance and security monitoring.
 *
 * @module lib/middleware/audit
 */

import { headers } from 'next/headers';
import { query } from '@/lib/db';

// =====================================================
// TYPES
// =====================================================

/**
 * All possible audit actions that can be logged.
 * Grouped by category for better organization.
 */
export type AuditAction =
	// Authentication actions
	| 'LOGIN'
	| 'LOGOUT'
	| 'REGISTER'
	| 'PASSWORD_RESET_REQUEST'
	| 'PASSWORD_RESET_COMPLETE'
	| 'EMAIL_VERIFICATION'
	// Team actions
	| 'TEAM_CREATE'
	| 'TEAM_UPDATE'
	| 'TEAM_DELETE'
	| 'TEAM_INVITE_CREATE'
	| 'TEAM_INVITE_ACCEPT'
	| 'TEAM_INVITE_REVOKE'
	| 'TEAM_MEMBER_ADD'
	| 'TEAM_MEMBER_REMOVE'
	| 'TEAM_MEMBER_UPDATE_ROLE'
	| 'TEAM_MEMBER_SUSPEND'
	| 'TEAM_MEMBER_REACTIVATE'
	// RAG actions
	| 'RAG_CREATE'
	| 'RAG_DELETE'
	| 'RAG_UPDATE'
	| 'RAG_ASSIGN'
	| 'RAG_UNASSIGN'
	| 'DOCUMENT_UPLOAD'
	| 'DOCUMENT_DELETE'
	| 'DOCUMENT_VIEW'
	// Chat actions
	| 'CHAT_QUERY'
	| 'CHAT_CONVERSATION_CREATE'
	| 'CHAT_CONVERSATION_DELETE'
	// Admin actions
	| 'ADMIN_USER_ROLE_ASSIGN'
	| 'ADMIN_USER_ROLE_REMOVE'
	| 'ADMIN_PLAN_UPDATE'
	| 'ADMIN_MIGRATION_RUN'
	| 'ADMIN_SETTINGS_UPDATE'
	// Permission actions
	| 'PERMISSION_GRANT'
	| 'PERMISSION_REVOKE'
	// Billing actions
	| 'BILLING_SUBSCRIPTION_CREATE'
	| 'BILLING_SUBSCRIPTION_CANCEL'
	| 'BILLING_PLAN_CHANGE'
	// Settings actions
	| 'SETTINGS_UPDATE'
	| 'PREFERENCES_UPDATE';

/**
 * Parameters for audit log entries.
 */
export interface AuditLogOptions {
	/** The action being performed */
	action: AuditAction;
	/** ID of the user performing the action */
	actorUserId?: string;
	/** Team slug (if action is team-specific) */
	teamSlug?: string;
	/** Type of the target entity (e.g., 'user', 'rag_package', 'team') */
	targetType?: string;
	/** ID of the target entity */
	targetId?: string;
	/** IP address of the actor */
	ipAddress?: string;
	/** User agent of the actor */
	userAgent?: string;
	/** Additional metadata about the action */
	metadata?: Record<string, unknown>;
}

/**
 * Result of an audit log operation.
 */
export interface AuditLogResult {
	success: boolean;
	logId?: string;
	error?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extracts client information from request headers.
 *
 * @param options - Optional IP and user agent (will be fetched from headers if not provided)
 * @returns Object containing IP address and user agent
 *
 * @example
 * ```typescript
 * const { ipAddress, userAgent } = await getClientInfo();
 * ```
 */
export async function getClientInfo(options?: {
	ipAddress?: string;
	userAgent?: string;
}): Promise<{ ipAddress: string; userAgent: string }> {
	let ipAddress = options?.ipAddress;
	let userAgent = options?.userAgent;

	if (!ipAddress || !userAgent) {
		try {
			const headersList = await headers();
			if (!ipAddress) {
				// Get IP from x-forwarded-for header (first IP in case of proxies)
				ipAddress = headersList.get('x-forwarded-for')?.split(',')[0].trim()
					|| headersList.get('x-real-ip')
					|| 'unknown';
			}
			if (!userAgent) {
				userAgent = headersList.get('user-agent') || 'unknown';
			}
		} catch (e) {
			// Headers might not be available in all contexts (e.g., background jobs)
			ipAddress = ipAddress || 'unknown';
			userAgent = userAgent || 'unknown';
		}
	}

	return { ipAddress, userAgent };
}

/**
 * Logs an audit event to the database.
 *
 * This function is designed to be non-blocking. If logging fails,
 * the error is logged to console but not thrown, to avoid breaking
 * the user flow.
 *
 * @param options - Audit log options
 * @returns Promise resolving when log is written (or failed silently)
 *
 * @example
 * ```typescript
 * await logAuditEvent({
 *   action: 'TEAM_MEMBER_ADD',
 *   actorUserId: 'user-123',
 *   teamSlug: 'my-team',
 *   targetType: 'team_member',
 *   targetId: 'member-456',
 *   metadata: { role: 'team-owner' }
 * });
 * ```
 */
export async function logAuditEvent(options: AuditLogOptions): Promise<AuditLogResult> {
	try {
		const { ipAddress, userAgent } = await getClientInfo({
			ipAddress: options.ipAddress,
			userAgent: options.userAgent,
		});

		const result = await query<{ id: string }>(
			`INSERT INTO projectnexus.audit_logs
			 (team_slug, actor_user_id, action, target_type, target_id, ip_address, user_agent, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 RETURNING id`,
			[
				options.teamSlug || null,
				options.actorUserId || null,
				options.action,
				options.targetType || null,
				options.targetId || null,
				ipAddress,
				userAgent,
				JSON.stringify(options.metadata || {}),
			]
		);

		const logId = result.rows[0]?.id;
		if (logId) {
			}

		return { success: true, logId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error(`[Audit] Failed to log event ${options.action}:`, errorMessage);
		// We intentionally do not throw here to avoid breaking the user flow
		return { success: false, error: errorMessage };
	}
}

/**
 * Creates a wrapper function that logs audit events before and after execution.
 *
 * This is useful for wrapping sensitive operations to ensure they are always logged.
 *
 * @param action - The audit action to log
 * @param fn - The function to wrap
 * @returns A wrapped function that logs audit events
 *
 * @example
 * ```typescript
 * const deleteRagPackage = withAudit('RAG_DELETE', async (ragId: string) => {
 *   await db.query('DELETE FROM rag_packages WHERE id = $1', [ragId]);
 *   return { success: true };
 * });
 *
 * // When called, it will log RAG_DELETE before and after execution
 * await deleteRagPackage('rag-123');
 * ```
 */
export function withAudit<T extends (...args: any[]) => Promise<any>>(
	action: AuditAction,
	fn: T
): T {
	return (async (...args: Parameters<T>) => {
		// Extract options from args if available (common pattern: first arg has metadata)
		const firstArg = args[0] as Record<string, unknown> | undefined;
		const auditOptions: AuditLogOptions = {
			action,
			actorUserId: (firstArg?.actorUserId as string) || undefined,
			teamSlug: (firstArg?.teamSlug as string) || undefined,
			targetType: (firstArg?.targetType as string) || undefined,
			targetId: (firstArg?.targetId as string) || undefined,
			metadata: {
				...((firstArg?.metadata as Record<string, unknown>) || {}),
				_startTime: new Date().toISOString(),
			},
		};

		// Log the start of the action
		await logAuditEvent(auditOptions);

		try {
			// Execute the wrapped function
			const result = await fn(...args);

			// Log successful completion
			await logAuditEvent({
				...auditOptions,
				metadata: {
					...auditOptions.metadata,
					_endTime: new Date().toISOString(),
					success: true,
				},
			});

			return result;
		} catch (error) {
			// Log failure
			await logAuditEvent({
				...auditOptions,
				metadata: {
					...auditOptions.metadata,
					_endTime: new Date().toISOString(),
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			});

			throw error;
		}
	}) as T;
}

// =====================================================
// CONVENIENCE FUNCTIONS FOR COMMON ACTIONS
// =====================================================

/**
 * Logs a team member role change.
 *
 * @param params - Role change parameters
 */
export async function logRoleChange(params: {
	actorUserId: string;
	teamSlug: string;
	targetUserId: string;
	oldRole: string;
	newRole: string;
}): Promise<void> {
	await logAuditEvent({
		action: 'TEAM_MEMBER_UPDATE_ROLE',
		actorUserId: params.actorUserId,
		teamSlug: params.teamSlug,
		targetType: 'team_member',
		targetId: params.targetUserId,
		metadata: {
			oldRole: params.oldRole,
			newRole: params.newRole,
		},
	});
}

/**
 * Logs a RAG package deletion.
 *
 * @param params - Deletion parameters
 */
export async function logRagDeletion(params: {
	actorUserId: string;
	teamSlug: string;
	ragId: string;
	ragName: string;
}): Promise<void> {
	await logAuditEvent({
		action: 'RAG_DELETE',
		actorUserId: params.actorUserId,
		teamSlug: params.teamSlug,
		targetType: 'rag_package',
		targetId: params.ragId,
		metadata: {
			ragName: params.ragName,
		},
	});
}

/**
 * Logs a user role assignment (global admin).
 *
 * @param params - Role assignment parameters
 */
export async function logGlobalRoleAssignment(params: {
	actorUserId: string;
	targetUserId: string;
	role: string;
	assigned: boolean; // true for assign, false for remove
}): Promise<void> {
	await logAuditEvent({
		action: params.assigned ? 'ADMIN_USER_ROLE_ASSIGN' : 'ADMIN_USER_ROLE_REMOVE',
		actorUserId: params.actorUserId,
		targetType: 'user',
		targetId: params.targetUserId,
		metadata: {
			role: params.role,
		},
	});
}

/**
 * Logs a document upload.
 *
 * @param params - Upload parameters
 */
export async function logDocumentUpload(params: {
	actorUserId: string;
	teamSlug: string;
	documentId: string;
	fileName: string;
	fileSize: number;
}): Promise<void> {
	await logAuditEvent({
		action: 'DOCUMENT_UPLOAD',
		actorUserId: params.actorUserId,
		teamSlug: params.teamSlug,
		targetType: 'document',
		targetId: params.documentId,
		metadata: {
			fileName: params.fileName,
			fileSize: params.fileSize,
		},
	});
}

/**
 * Logs a team invitation creation.
 *
 * @param params - Invitation parameters
 */
export async function logTeamInvitation(params: {
	actorUserId: string;
	teamSlug: string;
	email: string;
	role: string;
}): Promise<void> {
	await logAuditEvent({
		action: 'TEAM_INVITE_CREATE',
		actorUserId: params.actorUserId,
		teamSlug: params.teamSlug,
		targetType: 'invitation',
		metadata: {
			email: params.email,
			role: params.role,
		},
	});
}

/**
 * Logs a settings update.
 *
 * @param params - Settings update parameters
 */
export async function logSettingsUpdate(params: {
	actorUserId: string;
	teamSlug?: string;
	changes: Record<string, { old: unknown; new: unknown }>;
}): Promise<void> {
	await logAuditEvent({
		action: 'SETTINGS_UPDATE',
		actorUserId: params.actorUserId,
		teamSlug: params.teamSlug,
		targetType: 'settings',
		metadata: {
			changes: params.changes,
		},
	});
}
