'use client';

/**
 * PermissionGate Component
 *
 * Conditionally renders children based on user permissions.
 * Use this component to hide/show UI elements based on access control.
 */

import { useEffect, useState } from 'react';
import type { Permission } from '@/lib/permissions';

export interface PermissionGateProps {
  /** Single permission or array of permissions required */
  permission: Permission | Permission[];
  /** 'any' (default) = user needs at least one permission, 'all' = user needs all permissions */
  mode?: 'any' | 'all';
  /** The team slug to check permissions for */
  teamSlug: string;
  /** Optional fallback to show if user lacks permission (default: null = renders nothing) */
  fallback?: React.ReactNode;
  /** Children to render if user has permission */
  children: React.ReactNode;
  /** Optional callback when permission check completes */
  onPermissionCheck?: (hasPermission: boolean) => void;
}

/**
 * Conditionally render children based on user permissions.
 *
 * @example
 * ```tsx
 * // Single permission check
 * <PermissionGate permission="team.update" teamSlug={teamSlug}>
 *   <button>Edit Team</button>
 * </PermissionGate>
 *
 * // With fallback
 * <PermissionGate
 *   permission="team.manage_members"
 *   teamSlug={teamSlug}
 *   fallback={<div className="text-muted">No access</div>}
 * >
 *   <TeamMembersList />
 * </PermissionGate>
 *
 * // Multiple permissions (user needs all)
 * <PermissionGate
 *   permission={['team.update', 'team.invite']}
 *   mode="all"
 *   teamSlug={teamSlug}
 * >
 *   <AdminPanel />
 * </PermissionGate>
 *
 * // Multiple permissions (user needs at least one)
 * <PermissionGate
 *   permission={['team.update', 'rag.create']}
 *   mode="any"
 *   teamSlug={teamSlug}
 * >
 *   <QuickActions />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  permission,
  mode = 'any',
  teamSlug,
  fallback = null,
  children,
  onPermissionCheck,
}: PermissionGateProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPermission() {
      setLoading(true);

      try {
        const res = await fetch(`/api/user/permissions?teamSlug=${encodeURIComponent(teamSlug)}`);

        if (!res.ok) {
          console.error('Failed to fetch permissions for PermissionGate');
          setHasPermission(false);
          onPermissionCheck?.(false);
          return;
        }

        const data = await res.json();
        const userPermissions: Permission[] = data.permissions || [];

        let permitted = false;

        if (Array.isArray(permission)) {
          permitted =
            mode === 'any'
              ? permission.some((p) => userPermissions.includes(p))
              : permission.every((p) => userPermissions.includes(p));
        } else {
          permitted = userPermissions.includes(permission);
        }

        setHasPermission(permitted);
        onPermissionCheck?.(permitted);
      } catch (err) {
        console.error('Error checking permissions:', err);
        setHasPermission(false);
        onPermissionCheck?.(false);
      } finally {
        setLoading(false);
      }
    }

    checkPermission();
  }, [permission, mode, teamSlug, onPermissionCheck]);

  // Show nothing while loading (you could add a loading prop if needed)
  if (loading) {
    return null;
  }

  // Show fallback if permission check failed
  if (!hasPermission) {
    return <>{fallback}</>;
  }

  // Show children if user has permission
  return <>{children}</>;
}
