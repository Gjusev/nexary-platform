'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useUser } from '@stackframe/stack';

type UserRolesResponse = {
  success: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
  currentTeam?: {
    id: string;
    displayName: string;
  } | null;
  roles?: {
    all: string[];
    team: string | null;
    global: string[];
  };
  teamSlug?: string | null;
  permissions?: string[];
};

export function useTeam() {
  // We remove 'or: redirect' to debug the infinite loop. We'll handle redirect manually if needed.
  const user = useUser();

  const rawTeams = user?.useTeams();
  const teams = useMemo(() => rawTeams || [], [rawTeams]);
  const currentTeam = teams[0] || null;

  // State for roles from PostgreSQL
  const [rolesData, setRolesData] = useState<UserRolesResponse | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // Fetch roles from PostgreSQL
  const fetchRoles = useCallback(async () => {
    if (!user) return;

    setRolesLoading(true);
    setRolesError(null);

    try {
      const res = await fetch('/api/user/roles');
      if (res.ok) {
        const data = await res.json();
        setRolesData(data);
      } else {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        setRolesError(error.error || 'Failed to fetch roles');
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRolesError('Failed to fetch roles');
    } finally {
      setRolesLoading(false);
    }
  }, [user]);

  // Fetch roles on mount and when user changes
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Team info from Stack Auth
  const teamSlug = currentTeam?.id || null;
  const teamName = currentTeam?.displayName || null;

  // Roles from PostgreSQL
  const allRoles = useMemo(() => rolesData?.roles?.all || [], [rolesData]);
  const teamRole = useMemo(
    () => rolesData?.roles?.team || null,
    [rolesData]
  );
  const globalRoles = useMemo(
    () => rolesData?.roles?.global || [],
    [rolesData]
  );
  const permissions = useMemo(
    () => rolesData?.permissions || [],
    [rolesData]
  );

  const roleSet = useMemo(() => new Set(allRoles), [allRoles]);

  // Check if user is owner/leader
  const isOwner = useMemo(() => {
    return (
      roleSet.has('team-owner') ||
      roleSet.has('team-leader') ||
      roleSet.has('global-admin')
    );
  }, [roleSet]);

  // Check if user is global admin
  const isGlobalAdmin = useMemo(() => {
    return roleSet.has('global-admin');
  }, [roleSet]);

  return {
    teamSlug,
    teamName,
    roles: allRoles,
    teamRole,
    globalRoles,
    permissions,
    status: user ? 'authenticated' : 'unauthenticated',
    isLoading: user === undefined || rolesLoading,
    isAuthenticated: !!user,
    hasRole: (role: string) => roleSet.has(role),
    hasPermission: (permission: string) => permissions.includes(permission),
    isOwner,
    isGlobalAdmin,
    session: user,
    user,
    currentTeam,
    refreshRoles: fetchRoles,
    rolesError,
  };
}
