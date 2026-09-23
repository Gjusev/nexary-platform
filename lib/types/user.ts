/**
 * Type definitions for user-related data structures.
 *
 * This module provides TypeScript interfaces for Stack Auth users,
 * team members, and permission-related types.
 */

/**
 * Stack Auth user interface.
 * Represents a user from the Stack Auth system.
 */
export interface StackUser {
  /** Unique user identifier */
  id: string;
  /** User's primary email address */
  primaryEmail: string | null;
  /** Display name for the user */
  displayName: string | null;
  /** Profile image URL */
  profileImageUrl?: string | null;
  /** Server-side metadata stored on the user */
  serverMetadata?: ServerMetadata;
  /** Client-side metadata stored on the user */
  clientMetadata?: ClientMetadata;
  /** Check if user has a specific permission (Stack Auth method) */
  hasPermission?: (team: unknown, permission: string) => boolean | Promise<boolean>;
  /** List teams for this user */
  listTeams?: () => Promise<StackTeam[]>;
  /** Currently selected team */
  selectedTeam?: StackTeam;
  /** Update user metadata (Stack Auth method) */
  update?: (options: { serverMetadata?: Record<string, unknown>; clientMetadata?: Record<string, unknown> }) => Promise<void>;
  /** Set selected team (Stack Auth method) */
  setSelectedTeam?: (team: StackTeam) => Promise<void>;
}

/**
 * Stack Auth team interface.
 */
export interface StackTeam {
  /** Unique team identifier */
  id: string;
  /** Team display name */
  displayName: string;
  /** Team profile image */
  profileImageUrl?: string | null;
  /** Server-side metadata (not always present in base StackTeam) */
  serverMetadata?: Record<string, unknown>;
  /** List team members (Stack Auth method) */
  listUsers?: () => Promise<StackUser[]>;
}

/**
 * Server-side metadata attached to Stack Auth users.
 */
export interface ServerMetadata {
  /** Array of role names assigned to the user */
  roles?: string[];
  /** User's team role (legacy field) */
  teamRole?: string;
  /** User preferences */
  preferences?: {
    /** User's preferred language */
    language?: string;
    /** Other preferences */
    [key: string]: unknown;
  };
  /** Email verification status */
  emailVerified?: boolean;
  /** Database sync status */
  dbSynced?: boolean;
  /** Custom metadata key-value pairs */
  [key: string]: unknown;
}

/**
 * Client-side metadata attached to Stack Auth users.
 */
export interface ClientMetadata {
  /** Array of role names assigned to the user */
  roles?: string[];
  /** User preferences */
  preferences?: {
    /** User's preferred language */
    language?: string;
    /** Other preferences */
    [key: string]: unknown;
  };
  /** Custom metadata key-value pairs */
  [key: string]: unknown;
}

/**
 * Team member information from PostgreSQL.
 */
export interface TeamMember {
  /** Unique member identifier */
  id: string;
  /** Team ID (UUID) */
  team_id: string;
  /** User ID from Stack Auth */
  user_id: string;
  /** Member's email address */
  email: string;
  /** Member's display name */
  name: string | null;
  /** Member role within the team */
  role: TeamRole;
  /** Member status */
  status: TeamMemberStatus;
  /** When the member joined the team */
  joined_at: string;
  /** Last active timestamp */
  last_active: string | null;
  /** When the member was suspended (if applicable) */
  suspended_at: string | null;
  /** User ID who suspended the member */
  suspended_by: string | null;
  /** Reason for suspension */
  suspension_reason: string | null;
  /** When the member was removed (if applicable) */
  removed_at: string | null;
  /** User ID who removed the member */
  removed_by: string | null;
  /** Last update timestamp */
  updated_at: string;
  /** User ID who last updated the record */
  updated_by: string | null;
}

/**
 * Available team roles.
 */
export type TeamRole = 'team-owner' | 'team-leader' | 'member';

/**
 * Team member status values.
 */
export type TeamMemberStatus = 'active' | 'suspended' | 'removed';

/**
 * Global role assignment from PostgreSQL.
 */
export interface GlobalRoleAssignment {
  /** Unique assignment identifier */
  id: string;
  /** User ID from Stack Auth */
  user_id: string;
  /** Role name */
  role: GlobalRole;
  /** When the role was assigned */
  created_at: string;
}

/**
 * Available global roles.
 */
export type GlobalRole = 'global-admin' | 'global-rag-admin';

/**
 * User role information combining team and global roles.
 */
export interface UserRoleInfo {
  /** All roles combined (team + global) */
  all: string[];
  /** Team-specific role (if user has a team) */
  team: TeamRole | null;
  /** Global roles assigned to the user */
  global: GlobalRole[];
}

/**
 * User permissions information.
 */
export interface UserPermissions {
  /** Array of permission strings */
  permissions: string[];
  /** User role information */
  roles: UserRoleInfo;
  /** Current team slug */
  teamSlug: string | null;
}

/**
 * Team information.
 */
export interface Team {
  /** Unique team identifier (UUID) */
  id: string;
  /** Team slug (URL-friendly identifier) */
  slug: string;
  /** Team display name */
  name: string;
  /** Team description */
  description: string | null;
  /** When the team was created */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Number of active members */
  memberCount?: number;
}

/**
 * User profile with team information.
 */
export interface UserProfile {
  /** User ID from Stack Auth */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  displayName: string;
  /** Current team information */
  currentTeam?: Team | null;
}

/**
 * Response from /api/user/roles endpoint.
 */
export interface UserRolesResponse {
  /** Success indicator */
  success: boolean;
  /** User profile information */
  user?: UserProfile;
  /** Current team information */
  currentTeam?: {
    id: string;
    displayName: string;
  } | null;
  /** User role information */
  roles?: UserRoleInfo;
  /** Current team slug */
  teamSlug?: string | null;
  /** User permissions */
  permissions?: string[];
}

/**
 * Audit log entry for user actions.
 */
export interface AuditLogEntry {
  /** Unique log identifier */
  id: string;
  /** Team slug (if applicable) */
  team_slug: string | null;
  /** User ID who performed the action */
  actor_user_id: string | null;
  /** Action performed */
  action: string;
  /** Type of target affected */
  target_type: string | null;
  /** ID of target affected */
  target_id: string | null;
  /** IP address of the actor */
  ip_address: string | null;
  /** User agent of the actor */
  user_agent: string | null;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** When the action was performed */
  created_at: string;
}
