'use client';

/**
 * React hook for fetching and managing user permissions.
 *
 * Provides permission checking functionality for UI components
 * to conditionally render elements based on user access.
 */

import { useEffect, useState, useCallback } from 'react';
import type { Permission } from '@/lib/permissions-config';

export interface UsePermissionsResult {
  /** Array of permission strings the user has */
  permissions: Permission[];
  /** Loading state while fetching permissions */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Check if user has a specific permission */
  hasPermission: (required: Permission | Permission[], mode?: 'any' | 'all') => boolean;
}

/**
 * Hook to fetch and manage user permissions for a specific team.
 *
 * @param teamSlug - The team slug to fetch permissions for
 * @returns Object containing permissions, loading state, and helper functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { permissions, loading, hasPermission } = usePermissions('my-team');
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {hasPermission('team.update') && (
 *         <button>Edit Team</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions(teamSlug: string): UsePermissionsResult {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/user/permissions?teamSlug=${encodeURIComponent(teamSlug)}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch permissions: ${res.status}`);
      }

      const data = await res.json();
      setPermissions(data.permissions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [teamSlug]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /**
   * Check if user has a specific permission or permissions
   *
   * @param required - Permission string or array of permissions
   * @param mode - 'any' (default) means user needs at least one permission, 'all' means user needs all permissions
   * @returns true if user has the required permission(s)
   */
  const hasPermission = useCallback(
    (required: Permission | Permission[], mode: 'any' | 'all' = 'any'): boolean => {
      if (permissions.length === 0) return false;

      if (Array.isArray(required)) {
        return mode === 'any'
          ? required.some((p) => permissions.includes(p))
          : required.every((p) => permissions.includes(p));
      }

      return permissions.includes(required);
    },
    [permissions]
  );

  return {
    permissions,
    loading,
    error,
    hasPermission,
  };
}
