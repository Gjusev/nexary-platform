'use client';

/**
 * Mobile Navigation Component
 *
 * Bottom navigation bar for mobile devices that provides quick access to key features:
 * - Chat/Dashboard toggle
 * - Quick navigation to main sections
 * - Permission-based filtering
 * - Safe area inset support for iOS
 */

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  LayoutDashboard,
  Database,
  Users,
  Settings,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/components/auth/use-permissions';
import type { Permission } from '@/lib/permissions';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  href: string;
  requiredPermission?: Permission;
}

const MOBILE_NAV_ITEMS: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    href: '/chat',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    id: 'rag',
    label: 'Knowledge',
    icon: Database,
    href: '/dashboard/rag',
    requiredPermission: 'rag.query',
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    href: '/dashboard/team',
    requiredPermission: 'team.view',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings',
  },
];

interface MobileNavProps {
  /** Team slug for permission checking */
  teamSlug: string;
  /** Callback when menu button is clicked (for opening sidebar) */
  onMenuClick?: () => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Mobile bottom navigation component.
 *
 * Displays a bottom navigation bar on mobile devices with quick access
 * to main features. Items are filtered based on user permissions.
 *
 * @example
 * ```tsx
 * <MobileNav
 *   teamSlug={teamSlug}
 *   onMenuClick={() => setMobileSidebarOpen(true)}
 * />
 * ```
 */
export function MobileNav({ teamSlug, onMenuClick, className }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { permissions, loading } = usePermissions(teamSlug);

  // Filter nav items based on permissions
  const visibleItems = MOBILE_NAV_ITEMS.filter((item) => {
    if (item.requiredPermission && !loading) {
      return permissions.includes(item.requiredPermission);
    }
    return true;
  });

  const isActive = (href: string) => {
    if (href === '/chat') {
      return pathname === '/chat' || pathname?.startsWith('/chat/');
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden',
        className
      )}
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
      }}
    >
      {/* Menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="flex flex-col items-center gap-1 h-auto py-2 px-3 text-xs"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px]">Menu</span>
      </Button>

      {/* Navigation items */}
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2 px-3 text-xs',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => router.push(item.href)}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{item.label}</span>
          </Button>
        );
      })}

      {/* Spacer for balance if odd number of items */}
      {visibleItems.length % 2 === 0 && (
        <div className="w-[68px] shrink-0" />
      )}
    </nav>
  );
}

/**
 * Hook to get the safe bottom padding value for mobile devices.
 * This can be used to add padding to content above the mobile nav.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { paddingBottom } = useMobileNavPadding();
 *   return <div style={{ paddingBottom }}>Content</div>;
 * }
 * ```
 */
export function useMobileNavPadding() {
  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // Get safe area inset
  const safeAreaBottom = typeof window !== 'undefined'
    ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('safe-area-inset-bottom')) || 0
    : 0;

  const navHeight = 60; // Base nav height
  const padding = isMobile ? navHeight + safeAreaBottom + 20 : 0; // 20px extra

  return { paddingBottom: `${padding}px`, isMobile };
}
