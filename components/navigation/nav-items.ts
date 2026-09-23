/**
 * Navigation Items Configuration
 *
 * Centralized configuration for all navigation items across the application.
 * Items are filtered based on user permissions and context (chat/dashboard).
 */

import {
  MessageSquare,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Shield,
  Database,
  BarChart3,
  PlusCircle,
  History,
} from 'lucide-react';
import type { Permission } from '@/lib/permissions';

export interface NavItem {
  /** Unique identifier for the nav item */
  id: string;
  /** Display label for the nav item */
  label: string;
  /** Lucide React icon component */
  icon: any;
  /** Navigation path */
  href: string;
  /** Permission required to view this item (undefined = visible to all) */
  requiredPermission?: Permission;
  /** Optional badge to display (number or string) */
  badge?: number | string;
  /** Optional child items for dropdown/nested navigation */
  children?: NavItem[];
  /** Contexts where this item should be shown (undefined = shown in both) */
  contexts?: ('chat' | 'dashboard')[];
}

/**
 * All navigation items for the application.
 * These are filtered based on:
 * 1. Current context (chat/dashboard)
 * 2. User permissions
 */
export const NAV_ITEMS: NavItem[] = [
  // =====================================================
  // DASHBOARD CONTEXT ITEMS
  // =====================================================

  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    contexts: ['dashboard'],
  },
  {
    id: 'chat-link',
    label: 'Chat',
    icon: MessageSquare,
    href: '/chat',
    contexts: ['dashboard'],
  },
  {
    id: 'team',
    label: 'Equipo',
    icon: Users,
    href: '/dashboard/team',
    requiredPermission: 'team.view',
    contexts: ['dashboard'],
    children: [
      {
        id: 'team-members',
        label: 'Miembros',
        icon: Users,
        href: '/dashboard/team',
        requiredPermission: 'team.view',
      },
      {
        id: 'team-invite',
        label: 'Invitar',
        icon: PlusCircle,
        href: '/dashboard/team/invite',
        requiredPermission: 'team.invite',
      },
    ],
  },
  {
    id: 'rag',
    label: 'Base de Conocimiento',
    icon: Database,
    href: '/dashboard/rag',
    requiredPermission: 'rag.query',
    contexts: ['dashboard'],
    children: [
      {
        id: 'rag-packages',
        label: 'Paquetes RAG',
        icon: FileText,
        href: '/dashboard/rag',
        requiredPermission: 'rag.query',
      },
      {
        id: 'rag-create',
        label: 'Crear Paquete',
        icon: PlusCircle,
        href: '/dashboard/rag/new',
        requiredPermission: 'rag.create',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analíticas',
    icon: BarChart3,
    href: '/dashboard/analytics',
    requiredPermission: 'team.view',
    contexts: ['dashboard'],
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: Settings,
    href: '/dashboard/settings',
    contexts: ['dashboard'],
  },

  // =====================================================
  // CHAT CONTEXT ITEMS
  // =====================================================

  {
    id: 'conversations',
    label: 'Conversaciones',
    icon: MessageSquare,
    href: '/chat',
    contexts: ['chat'],
  },
  {
    id: 'new-chat',
    label: 'Nueva Conversación',
    icon: PlusCircle,
    href: '/chat/new',
    contexts: ['chat'],
  },
  {
    id: 'chat-history',
    label: 'Historial',
    icon: History,
    href: '/chat/history',
    contexts: ['chat'],
  },

  // =====================================================
  // ADMIN ITEMS (global-admin only)
  // =====================================================

  {
    id: 'admin',
    label: 'Administración',
    icon: Shield,
    href: '/admin',
    requiredPermission: 'admin.view_all_teams',
    contexts: ['dashboard'],
  },
];

/**
 * Filter navigation items based on context and user permissions.
 *
 * @param context - The current context ('chat' or 'dashboard')
 * @param userPermissions - Array of permissions the user has
 * @returns Filtered array of navigation items
 *
 * @example
 * ```ts
 * const items = filterNavItems('dashboard', userPermissions);
 * // Returns only dashboard items that the user has permission to see
 * ```
 */
export function filterNavItems(
  context: 'chat' | 'dashboard',
  userPermissions: Permission[]
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    // Filter by context
    if (item.contexts && !item.contexts.includes(context)) {
      return false;
    }

    // Filter by permission
    if (item.requiredPermission && !userPermissions.includes(item.requiredPermission)) {
      return false;
    }

    // Filter children
    if (item.children) {
      item.children = item.children.filter(
        (child) => !child.requiredPermission || userPermissions.includes(child.requiredPermission)
      );
    }

    return true;
  }).map((item) => ({
    ...item,
    children: item.children?.filter(
      (child) => !child.requiredPermission || userPermissions.includes(child.requiredPermission)
    ),
  }));
}
