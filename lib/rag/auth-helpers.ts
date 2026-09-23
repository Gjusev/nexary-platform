import { stackServerAppForMiddleware } from '@/lib/stack/stack-server';
import { query } from '@/lib/db';
import type { StackTeam } from '@/lib/types/user';

export function getStackServerAppFromCookies() {
  return stackServerAppForMiddleware;
}

export function readTeamSlug(team: unknown): string | null {
  if (!team || typeof team !== 'object') return null;
  const typedTeam = team as StackTeam;
  const metadata = typedTeam.serverMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const slug = (metadata as Record<string, unknown>).slug;
  if (typeof slug === 'string' && slug.trim().length > 0) {
    return slug;
  }
  return null;
}

function normalizeRole(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/_/g, '-').trim();
  return normalized.length > 0 ? normalized : null;
}

export async function collectUserRoles(
  userId: string,
  serverMetadata: Record<string, unknown> | undefined
): Promise<Set<string>> {
  const roles = new Set<string>();

  const metadataRolesRaw = serverMetadata?.roles;
  if (Array.isArray(metadataRolesRaw)) {
    for (const role of metadataRolesRaw) {
      const normalized = normalizeRole(role);
      if (normalized) {
        roles.add(normalized);
      }
    }
  }

  const teamRole = normalizeRole(serverMetadata?.['teamRole']);
  if (teamRole) {
    roles.add(teamRole);
  }

  const { rows } = await query<{ role: string }>(
    'SELECT role FROM role_assignments WHERE user_id = $1',
    [userId]
  );
  for (const row of rows) {
    const normalized = normalizeRole(row.role);
    if (normalized) {
      roles.add(normalized);
    }
  }

  return roles;
}

export async function findTeamForSlug(user: any, teamSlug: string) {
  const teams = await user?.listTeams?.();
  const teamList = Array.isArray(teams) ? teams : [];
  let targetTeam = teamList.find((team) => readTeamSlug(team) === teamSlug) ?? null;
  if (!targetTeam) {
    const { rows: dbTeams } = await query<{ id: string }>(
      'SELECT id FROM teams WHERE slug = $1 LIMIT 1',
      [teamSlug]
    );
    const fallbackTeamId = dbTeams[0]?.id;
    if (fallbackTeamId) {
      targetTeam = teamList.find((team) => team.id === fallbackTeamId) ?? null;
    }
  }
  return { targetTeam, teamList };
}
