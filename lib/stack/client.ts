import type { ReadonlyJson } from '@stackframe/stack-shared/dist/utils/json';
import type { ServerTeam, ServerUser } from '@stackframe/stack';

import { createStackServerApp } from '@/lib/stack/stack-server';
import type { StackUser } from '@/lib/types/user';

// Extended Stack server app type with internal methods
interface StackServerAppExtended {
  createUser: (options: {
    primaryEmail: string;
    password: string;
    displayName: string;
    primaryEmailAuthEnabled: boolean;
  }) => Promise<ServerUser>;
  listUsers: (options: { query: string; limit: number }) => Promise<ServerUser[]>;
  getUser: (userId: string) => Promise<ServerUser | null>;
  createTeam: (options: { displayName: string }) => Promise<ServerTeam>;
}

export class StackAuthError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'StackAuthError';
  }
}

interface TeamSummary {
  id: string;
  slug: string | null;
  name: string;
}

interface ProfileSummary {
  user: { id: string; email: string | null };
  team?: TeamSummary & { ownerId: string | null };
  roles: string[];
}

const TEAM_METADATA_KEYS = {
  slug: 'slug',
  ownerId: 'ownerId',
} as const;

type TeamMetadata = Record<string, string | null>;

interface ErrorWithMessage {
  message?: string;
  status?: number;
}

function normalizeStackError(error: unknown, fallbackMessage: string): StackAuthError {
  if (error instanceof StackAuthError) {
    return error;
  }

  if (error && typeof error === 'object') {
    const err = error as ErrorWithMessage;
    const message = typeof err.message === 'string' ? err.message : fallbackMessage;
    const statusCode = typeof err.status === 'number' ? err.status : undefined;
    return new StackAuthError(message, statusCode, error);
  }

  return new StackAuthError(fallbackMessage);
}

function slugifyTeamName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = normalized || 'team';
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

function readTeamMetadata(team: ServerTeam): TeamMetadata {
  const metadata = (team as { serverMetadata?: Record<string, unknown> }).serverMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const result: TeamMetadata = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === 'string' || value === null) {
      result[key] = value;
    }
  }
  return result;
}

function toTeamSummary(team: ServerTeam, fallbackSlug?: string): TeamSummary {
  const metadata = readTeamMetadata(team);
  const slugValue = metadata[TEAM_METADATA_KEYS.slug];
  return {
    id: team.id,
    slug: typeof slugValue === 'string' ? slugValue : fallbackSlug ?? null,
    name: team.displayName,
  };
}

function deriveRoles(userId: string, team: ServerTeam | null): string[] {
  if (!team) {
    return [];
  }
  const metadata = readTeamMetadata(team);
  const ownerValue = metadata[TEAM_METADATA_KEYS.ownerId];
  if (typeof ownerValue === 'string' && ownerValue === userId) {
    return ['team-owner'];
  }
  return ['team-member'];
}
async function ensureTeamMetadata(team: ServerTeam, metadata: TeamMetadata): Promise<void> {
  const update: { serverMetadata: ReadonlyJson } = {
    serverMetadata: metadata as ReadonlyJson,
  };
  await team.update(update);
}
export async function createUserAccount(input: {
  email: string;
  password: string;
  name: string;
}): Promise<{ userId: string; user: ServerUser }> {
  try {
    const app = createStackServerApp() as unknown as StackServerAppExtended;
    const user = await app.createUser({
      primaryEmail: input.email,
      password: input.password,
      displayName: input.name,
      primaryEmailAuthEnabled: true,
    });
    return { userId: user.id, user };
  } catch (error) {
    throw normalizeStackError(error, 'Failed to create Stack Auth user');
  }
}

export async function createTeam(teamName: string, ownerId?: string): Promise<TeamSummary> {
  try {
    const app = createStackServerApp();
    const slug = slugifyTeamName(teamName);
    const team = await app.createTeam({
      displayName: teamName,
    });

    await ensureTeamMetadata(team, {
      [TEAM_METADATA_KEYS.slug]: slug,
      [TEAM_METADATA_KEYS.ownerId]: ownerId ?? null,
    });

    return { id: team.id, slug, name: team.displayName };
  } catch (error) {
    throw normalizeStackError(error, 'Failed to create Stack Auth team');
  }
}

export async function addUserToTeam(input: {
  userId: string;
  teamId: string;
  role: string;
}): Promise<void> {
  try {
    const app = createStackServerApp();
    const team = await app.getTeam(input.teamId);
    if (!team) {
      throw new StackAuthError('Team not found', 404);
    }

    await team.addUser(input.userId);

    if (input.role === 'team-owner') {
      const metadata = {
        ...readTeamMetadata(team),
        [TEAM_METADATA_KEYS.ownerId]: input.userId,
      };
      await ensureTeamMetadata(team, metadata);
    }
  } catch (error) {
    throw normalizeStackError(error, 'Failed to add user to team');
  }
}

export async function findTeamBySlug(slug: string): Promise<TeamSummary | null> {
  try {
    const app = createStackServerApp();
    const teams = await app.listTeams();

    console.debug('[Stack Client] Finding team by slug:', {
      slug,
      teamsCount: teams.length
    });

    // First try to find by metadata slug
    let match = teams.find((team) => readTeamMetadata(team)[TEAM_METADATA_KEYS.slug] === slug);
    // If not found, try to find by team ID (for teams created without metadata)
    if (!match) {
      match = teams.find((team) => team.id === slug);
      }
    
    return match ? toTeamSummary(match) : null;
  } catch (error) {
    console.error('[findTeamBySlug] Error:', error);
    throw normalizeStackError(error, 'Failed to locate Stack Auth team');
  }
}

export async function findTeamById(teamId: string): Promise<TeamSummary | null> {
  try {
    const app = createStackServerApp();
    const teams = await app.listTeams();
    const match = teams.find((team) => team.id === teamId);
    return match ? toTeamSummary(match) : null;
  } catch (error) {
    throw normalizeStackError(error, 'Failed to locate Stack Auth team by ID');
  }
}

export async function createTeamWithOwner(input: {
  teamName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}): Promise<{ team: TeamSummary; owner: { userId: string; user: ServerUser } }> {
  try {
    const app = createStackServerApp() as unknown as StackServerAppExtended;
    const owner = await app.createUser({
      primaryEmail: input.ownerEmail,
      password: input.ownerPassword,
      displayName: input.ownerName,
      primaryEmailAuthEnabled: true,
    });

    const slug = slugifyTeamName(input.teamName);
    const team = await app.createTeam({
      displayName: input.teamName,
    });

    // Add owner to team with admin permissions
    await team.addUser(owner.id);
    
    // Grant team_admin permission to the owner
    try {
      // Type assertion needed as grantTeamPermission may not be in public types
      const ownerWithPermissions = owner as unknown as { grantTeamPermission?: (team: ServerTeam, permission: string) => Promise<void> };
      await ownerWithPermissions.grantTeamPermission?.(team, 'team_admin');
      } catch (permError) {
      console.error('Failed to grant team_admin permission:', permError);
      // Continue - we'll still have the role in PostgreSQL
    }

    await ensureTeamMetadata(team, {
      [TEAM_METADATA_KEYS.slug]: slug,
      [TEAM_METADATA_KEYS.ownerId]: owner.id,
    });

    // Sync team and owner to PostgreSQL immediately with correct role
    try {
      const { query } = await import('@/lib/db');
      
      // Create team in PostgreSQL
      await query(
        `INSERT INTO teams (id, slug, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           updated_at = NOW()`,
        [team.id, team.id, team.displayName]
      );

      // Add owner as team-owner in PostgreSQL
      await query(
        `INSERT INTO team_members (team_id, user_id, email, name, role, status, joined_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW())
         ON CONFLICT (team_id, user_id) DO UPDATE SET
           role = EXCLUDED.role,
           status = 'active',
           updated_at = NOW()`,
        [team.id, owner.id, input.ownerEmail, input.ownerName, 'team-owner']
      );

      } catch (dbError) {
      console.error('Failed to sync team to PostgreSQL:', dbError);
      // Don't throw - Stack Auth team was created successfully
    }

    return {
      team: { id: team.id, slug, name: team.displayName },
      owner: { userId: owner.id, user: owner },
    };
  } catch (error) {
    throw normalizeStackError(error, 'Failed to create team with owner in Stack Auth');
  }
}

export async function authenticateWithStackAuth(input: {
  email: string;
  password: string;
}): Promise<{ userId: string; email: string | null } | null> {
  try {
    // Stack Auth Server API doesn't have a direct password verification method
    // We need to use the Stack Auth REST API or validate against the database
    // For now, we'll list users and find by email (this is a workaround)
    const app = createStackServerApp() as unknown as StackServerAppExtended;
    const users = await app.listUsers({ query: input.email, limit: 1 });
    
    if (!users || users.length === 0) {
      return null;
    }

    const user = users[0];
    
    // Note: Stack Auth server-side doesn't expose password verification
    // You should either:
    // 1. Use Stack Auth's client-side authentication flow
    // 2. Validate credentials through Stack Auth's REST API
    // 3. Store password hashes in your own database
    
    // For now, returning the user if found (NOT SECURE - see note above)
    // TODO: Implement proper password verification
    return {
      userId: user.id,
      email: user.primaryEmail,
    };
  } catch (error) {
    throw normalizeStackError(error, 'Failed to authenticate with Stack Auth');
  }
}

export async function fetchStackProfile(userId: string): Promise<ProfileSummary> {
  try {
    const app = createStackServerApp() as unknown as StackServerAppExtended;
    const user = await app.getUser(userId);
    if (!user) {
      throw new StackAuthError('Stack Auth user not found', 404);
    }

    let primaryTeam: ServerTeam | null = null;

    const teams = await user.listTeams();
    primaryTeam = teams.length > 0 ? (teams[0] as ServerTeam) : null;

    const metadata = primaryTeam
      ? readTeamMetadata(primaryTeam)
      : undefined;
    const roles = deriveRoles(user.id, primaryTeam);

    return {
      user: { id: user.id, email: user.primaryEmail },
      team: primaryTeam
        ? {
            ...toTeamSummary(primaryTeam),
            ownerId:
              typeof metadata?.[TEAM_METADATA_KEYS.ownerId] === 'string'
                ? (metadata![TEAM_METADATA_KEYS.ownerId] as string)
                : null,
          }
        : undefined,
      roles,
    };
  } catch (error) {
    throw normalizeStackError(error, 'Failed to fetch Stack Auth profile');
  }
}
