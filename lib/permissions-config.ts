/**
 * Shared Permissions Configuration
 *
 * This file contains constant definitions for Roles and Permissions.
 * It is safe to import in client-side components as it has NO dependencies
 * on database or server-side libraries.
 */

// =====================================================
// ROLE DEFINITIONS
// =====================================================

export const ROLES = {
    // Team roles
    TEAM_OWNER: 'team-owner',      // Full control of team
    TEAM_LEADER: 'team-leader',    // Can manage team, invite members
    MEMBER: 'member',              // Read-only access

    // Global roles
    GLOBAL_ADMIN: 'global-admin',  // Platform administrator
    GLOBAL_RAG_ADMIN: 'global-rag-admin', // RAG administrator
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// =====================================================
// PERMISSION DEFINITIONS
// =====================================================

export const PERMISSIONS = {
    // Team permissions
    TEAM_UPDATE: 'team.update',
    TEAM_DELETE: 'team.delete',
    TEAM_INVITE: 'team.invite',
    TEAM_REMOVE_MEMBER: 'team.remove_member',
    TEAM_UPDATE_MEMBER: 'team.update_member',
    TEAM_VIEW: 'team.view',

    // RAG permissions
    RAG_CREATE: 'rag.create',
    RAG_DELETE: 'rag.delete',
    RAG_UPDATE: 'rag.update',
    RAG_QUERY: 'rag.query',
    RAG_INGEST: 'rag.ingest',

    // Admin permissions
    ADMIN_VIEW_ALL_TEAMS: 'admin.view_all_teams',
    ADMIN_MANAGE_PLANS: 'admin.manage_plans',
    ADMIN_MANAGE_BILLING: 'admin.manage_billing',
    ADMIN_ASSIGN_ROLES: 'admin.assign_roles',

    // ========== SECURITY PERMISSIONS (Advanced RBAC) ==========
    // SSO/SCIM Management
    SECURITY_MANAGE_SSO: 'security.manage_sso',
    SECURITY_MANAGE_SCIM: 'security.manage_scim',

    // Audit Logs
    SECURITY_VIEW_AUDIT_LOGS: 'security.view_audit_logs',
    SECURITY_EXPORT_AUDIT_LOGS: 'security.export_audit_logs',

    // API Keys
    SECURITY_MANAGE_API_KEYS: 'security.manage_api_keys',
    SECURITY_VIEW_API_KEYS: 'security.view_api_keys',

    // ========== COMPLIANCE PERMISSIONS ==========
    // GDPR/Data Privacy
    COMPLIANCE_MANAGE_RETENTION: 'compliance.manage_retention',
    COMPLIANCE_VIEW_REPORTS: 'compliance.view_reports',
    COMPLIANCE_MANAGE_CONSENTS: 'compliance.manage_consents',
    COMPLIANCE_EXPORT_DATA: 'compliance.export_data',

    // Data Residency
    DATA_MANAGE_RESIDENCY: 'data.manage_residency',
    DATA_VIEW_REGIONS: 'data.view_regions',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// =====================================================
// ROLE TO PERMISSION MAPPING
// =====================================================

export const ROLE_PERMISSIONS_MAP: Record<string, Permission[]> = {
    [ROLES.TEAM_OWNER]: [
        // Team permissions
        PERMISSIONS.TEAM_UPDATE,
        PERMISSIONS.TEAM_DELETE,
        PERMISSIONS.TEAM_INVITE,
        PERMISSIONS.TEAM_REMOVE_MEMBER,
        PERMISSIONS.TEAM_UPDATE_MEMBER,
        PERMISSIONS.TEAM_VIEW,
        // RAG permissions
        PERMISSIONS.RAG_CREATE,
        PERMISSIONS.RAG_DELETE,
        PERMISSIONS.RAG_UPDATE,
        PERMISSIONS.RAG_QUERY,
        PERMISSIONS.RAG_INGEST,
        // Security permissions (Team Owner gets all)
        PERMISSIONS.SECURITY_MANAGE_SSO,
        PERMISSIONS.SECURITY_MANAGE_SCIM,
        PERMISSIONS.SECURITY_VIEW_AUDIT_LOGS,
        PERMISSIONS.SECURITY_EXPORT_AUDIT_LOGS,
        PERMISSIONS.SECURITY_MANAGE_API_KEYS,
        PERMISSIONS.SECURITY_VIEW_API_KEYS,
        // Compliance permissions (Team Owner gets all)
        PERMISSIONS.COMPLIANCE_MANAGE_RETENTION,
        PERMISSIONS.COMPLIANCE_VIEW_REPORTS,
        PERMISSIONS.COMPLIANCE_MANAGE_CONSENTS,
        PERMISSIONS.COMPLIANCE_EXPORT_DATA,
        PERMISSIONS.DATA_MANAGE_RESIDENCY,
        PERMISSIONS.DATA_VIEW_REGIONS,
    ],
    [ROLES.TEAM_LEADER]: [
        // Team permissions
        PERMISSIONS.TEAM_UPDATE,
        PERMISSIONS.TEAM_INVITE,
        PERMISSIONS.TEAM_UPDATE_MEMBER,
        PERMISSIONS.TEAM_VIEW,
        // RAG permissions
        PERMISSIONS.RAG_CREATE,
        PERMISSIONS.RAG_UPDATE,
        PERMISSIONS.RAG_QUERY,
        PERMISSIONS.RAG_INGEST,
        // Security permissions (Team Leader gets view-only)
        PERMISSIONS.SECURITY_VIEW_AUDIT_LOGS,
        PERMISSIONS.SECURITY_VIEW_API_KEYS,
        // Compliance permissions (Team Leader gets view-only)
        PERMISSIONS.COMPLIANCE_VIEW_REPORTS,
        PERMISSIONS.DATA_VIEW_REGIONS,
    ],
    [ROLES.MEMBER]: [
        PERMISSIONS.TEAM_VIEW,
        PERMISSIONS.RAG_QUERY,
    ],
    [ROLES.GLOBAL_ADMIN]: [
        // Global admin has ALL permissions
        ...Object.values(PERMISSIONS),
    ],
    [ROLES.GLOBAL_RAG_ADMIN]: [
        PERMISSIONS.RAG_CREATE,
        PERMISSIONS.RAG_DELETE,
        PERMISSIONS.RAG_UPDATE,
        PERMISSIONS.RAG_QUERY,
        PERMISSIONS.RAG_INGEST,
        PERMISSIONS.ADMIN_VIEW_ALL_TEAMS,
    ],
};

// =====================================================
// API KEY SCOPES
// =====================================================

/**
 * API Key Scopes define what operations an API key can perform
 * These are used when creating API keys to restrict their access
 */
export const API_KEY_SCOPES = {
    // Team scopes
    TEAM_READ: 'team:read',
    TEAM_WRITE: 'team:write',

    // RAG scopes
    RAG_READ: 'rag:read',
    RAG_WRITE: 'rag:write',
    RAG_QUERY: 'rag:query',
    RAG_DELETE: 'rag:delete',

    // Document scopes
    DOCUMENTS_READ: 'documents:read',
    DOCUMENTS_WRITE: 'documents:write',
    DOCUMENTS_DELETE: 'documents:delete',

    // Chat scopes
    CHAT_READ: 'chat:read',
    CHAT_WRITE: 'chat:write',
    CHAT_DELETE: 'chat:delete',

    // Admin scopes (only for global admin API keys)
    ADMIN_ALL: 'admin:all',
    ADMIN_TEAMS_READ: 'admin:teams:read',
    ADMIN_TEAMS_WRITE: 'admin:teams:write',
    ADMIN_USERS_READ: 'admin:users:read',
    ADMIN_USERS_WRITE: 'admin:users:write',
} as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES];

/**
 * Default scope sets for common API key use cases
 */
export const API_KEY_SCOPE_PRESETS: Record<string, ApiKeyScope[]> = {
    // Read-only access
    read_only: [
        API_KEY_SCOPES.TEAM_READ,
        API_KEY_SCOPES.RAG_READ,
        API_KEY_SCOPES.DOCUMENTS_READ,
        API_KEY_SCOPES.CHAT_READ,
    ],
    // Full team access
    full_access: [
        API_KEY_SCOPES.TEAM_READ,
        API_KEY_SCOPES.TEAM_WRITE,
        API_KEY_SCOPES.RAG_READ,
        API_KEY_SCOPES.RAG_WRITE,
        API_KEY_SCOPES.RAG_QUERY,
        API_KEY_SCOPES.RAG_DELETE,
        API_KEY_SCOPES.DOCUMENTS_READ,
        API_KEY_SCOPES.DOCUMENTS_WRITE,
        API_KEY_SCOPES.DOCUMENTS_DELETE,
        API_KEY_SCOPES.CHAT_READ,
        API_KEY_SCOPES.CHAT_WRITE,
        API_KEY_SCOPES.CHAT_DELETE,
    ],
    // RAG only
    rag_only: [
        API_KEY_SCOPES.RAG_READ,
        API_KEY_SCOPES.RAG_WRITE,
        API_KEY_SCOPES.RAG_QUERY,
        API_KEY_SCOPES.RAG_DELETE,
    ],
    // Documents only
    documents_only: [
        API_KEY_SCOPES.DOCUMENTS_READ,
        API_KEY_SCOPES.DOCUMENTS_WRITE,
        API_KEY_SCOPES.DOCUMENTS_DELETE,
    ],
    // Chat only
    chat_only: [
        API_KEY_SCOPES.CHAT_READ,
        API_KEY_SCOPES.CHAT_WRITE,
    ],
    // Global admin (only for global admin users)
    global_admin: [
        API_KEY_SCOPES.ADMIN_ALL,
    ],
};
