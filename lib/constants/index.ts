/**
 * Global constants for the ProjectNexus application.
 *
 * Centralizes configuration values to avoid magic numbers
 * and improve maintainability.
 */

/**
 * File size and upload limits.
 */
export const Limits = {
  /** Maximum file size for uploads (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Maximum number of conversations per page */
  MAX_CONVERSATIONS_PER_PAGE: 20,
  /** Maximum messages per conversation to fetch */
  MAX_MESSAGES_PER_CONVERSATION: 100,
  /** Maximum number of team members allowed */
  MAX_TEAM_MEMBERS: 100,
  /** Maximum RAG packages per team */
  MAX_RAG_PACKAGES_PER_TEAM: 10,
  /** Text chunk size for RAG processing */
  CHUNK_SIZE: 2000,
  /** Text chunk overlap for RAG processing */
  CHUNK_OVERLAP: 100,
  /** Embedding batch size */
  EMBEDDING_BATCH_SIZE: 100,
  /** Maximum filename length */
  MAX_FILENAME_LENGTH: 255,
  /** Maximum team name length */
  MAX_TEAM_NAME_LENGTH: 100,
  /** Maximum team slug length */
  MAX_TEAM_SLUG_LENGTH: 50,
} as const;

/**
 * Timeout values in milliseconds.
 */
export const Timeouts = {
  /** Database query timeout */
  DATABASE_QUERY: 5000,
  /** API request timeout */
  API_REQUEST: 30000,
  /** File upload timeout */
  FILE_UPLOAD: 60000,
  /** Connection timeout */
  CONNECTION: 2000,
  /** Session timeout (30 minutes) */
  SESSION: 30 * 60 * 1000,
  /** Session update interval (5 minutes) */
  SESSION_UPDATE: 5 * 60 * 1000,
} as const;

/**
 * Cache TTL values in seconds.
 */
export const CacheTTL = {
  /** User roles cache (30 minutes) */
  USER_ROLES: 1800,
  /** Team slug cache (1 hour) */
  TEAM_SLUG: 3600,
  /** Permissions cache (15 minutes) */
  PERMISSIONS: 900,
  /** Team details cache (1 hour) */
  TEAM_DETAILS: 3600,
  /** RAG packages cache (30 minutes) */
  RAG_PACKAGES: 1800,
  /** Plans cache (1 hour) */
  PLANS: 3600,
} as const;

/**
 * Pagination settings.
 */
export const Pagination = {
  /** Default page size for list views */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum page size allowed */
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Role names (normalized).
 */
export const Roles = {
  /** Team owner role */
  TEAM_OWNER: 'team-owner',
  /** Team leader role */
  TEAM_LEADER: 'team-leader',
  /** Regular team member role */
  MEMBER: 'member',
  /** Global administrator role */
  GLOBAL_ADMIN: 'global-admin',
  /** Global RAG administrator role */
  GLOBAL_RAG_ADMIN: 'global-rag-admin',
} as const;

/**
 * Team member status values.
 */
export const TeamMemberStatus = {
  /** Active member */
  ACTIVE: 'active',
  /** Suspended member */
  SUSPENDED: 'suspended',
  /** Removed member */
  REMOVED: 'removed',
} as const;

/**
 * Subscription status values.
 */
export const SubscriptionStatus = {
  /** Active subscription */
  ACTIVE: 'active',
  /** Payment past due */
  PAST_DUE: 'past-due',
  /** Canceled subscription */
  CANCELED: 'canceled',
} as const;

/**
 * Default plan limits.
 */
export const DefaultPlanLimits = {
  /** Free plan member limit */
  FREE_MEMBERS: 10,
  /** Free plan RAG packages limit */
  FREE_RAGS: 3,
  /** Free plan documents processed limit */
  FREE_DOCS_PROCESSED: 20000,
  /** Free plan queries limit */
  FREE_QUERIES: 5000,
} as const;

/**
 * Chat message roles.
 */
export const ChatRoles = {
  /** User message */
  USER: 'user',
  /** Assistant message */
  ASSISTANT: 'assistant',
  /** System message */
  SYSTEM: 'system',
} as const;

/**
 * RAG package scopes.
 */
export const RagScopes = {
  /** Team-scoped RAG package */
  TEAM: 'team',
  /** Globally accessible RAG package */
  GLOBAL: 'global',
} as const;

/**
 * Environment names.
 */
export const Environment = {
  /** Development environment */
  DEVELOPMENT: 'development',
  /** Production environment */
  PRODUCTION: 'production',
  /** Test environment */
  TEST: 'test',
} as const;

/**
 * Audit log actions.
 */
export const AuditActions = {
  /** User login */
  LOGIN: 'LOGIN',
  /** User logout */
  LOGOUT: 'LOGOUT',
  /** Team created */
  TEAM_CREATED: 'TEAM_CREATED',
  /** Team deleted */
  TEAM_DELETED: 'TEAM_DELETED',
  /** Team updated */
  TEAM_UPDATED: 'TEAM_UPDATED',
  /** Member added to team */
  MEMBER_ADDED: 'MEMBER_ADDED',
  /** Member removed from team */
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  /** Member role changed */
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  /** RAG package created */
  RAG_CREATED: 'RAG_CREATED',
  /** RAG package deleted */
  RAG_DELETED: 'RAG_DELETED',
  /** RAG package updated */
  RAG_UPDATED: 'RAG_UPDATED',
  /** Document uploaded */
  DOC_UPLOADED: 'DOC_UPLOADED',
  /** Document deleted */
  DOC_DELETED: 'DOC_DELETED',
  /** Plan changed */
  PLAN_CHANGED: 'PLAN_CHANGED',
} as const;

/**
 * Error messages (standardized).
 * Re-exported from @/lib/errors/error-messages for consistency.
 *
 * @module lib/constants
 */
export { ErrorMessages, type ErrorMessageKey } from '@/lib/errors/error-messages';

/**
 * Supported file types for document upload.
 */
export const SupportedFileTypes = {
  /** PDF documents */
  PDF: 'application/pdf',
  /** Text files */
  TEXT: 'text/plain',
  /** Markdown files */
  MARKDOWN: 'text/markdown',
  /** Word documents */
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  /** Plain text (csv) */
  CSV: 'text/csv',
} as const;

/**
 * Allowed file extensions for upload.
 */
export const AllowedExtensions = [
  '.pdf',
  '.txt',
  '.md',
  '.docx',
  '.csv',
  '.json',
] as const;
