'use client';

/**
 * Unified Sidebar Component
 *
 * A shared sidebar component for both chat and dashboard contexts.
 * Filters navigation items based on user permissions.
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@stackframe/stack';
import { LogOut, User, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Permission } from '@/lib/permissions';
import { filterNavItems, type NavItem } from './nav-items';

// LocalStorage key for sidebar collapse state
const SIDEBAR_COLLAPSE_KEY = 'sidebar-collapsed';

interface UnifiedSidebarProps {
  /** Current context - 'chat' or 'dashboard' */
  context: 'chat' | 'dashboard';
  /** User permissions for filtering nav items */
  userPermissions: Permission[];
  /** Team slug (for future use) */
  teamSlug: string;
  /** Custom class name for the sidebar */
  className?: string;
  /** Custom class name when collapsed */
  collapsedClassName?: string;
  /** Callback when navigation happens */
  onNavigate?: () => void;
  /** Show close button (for mobile) */
  showCloseButton?: boolean;
  /** Callback when close button is clicked */
  onClose?: () => void;
}

export function UnifiedSidebar({
  context,
  userPermissions,
  teamSlug,
  className,
  collapsedClassName,
  onNavigate,
  showCloseButton,
  onClose,
}: UnifiedSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();

  // Collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Save collapse state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(isCollapsed));
    } catch {
      // Ignore storage errors
    }
  }, [isCollapsed]);

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  // Filter nav items based on context and permissions
  const navItems = useMemo(() => {
    return filterNavItems(context, userPermissions);
  }, [context, userPermissions]);

  const getUserInitials = () => {
    if (!user) return '?';
    const displayName = user.displayName || user.primaryEmail || '';
    return displayName.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await user?.signOut();
    router.push('/login');
  };

  // Render collapsed version
  if (isCollapsed) {
    return (
      <div
        className={cn(
          'flex h-full w-16 flex-col border-r border-sidebar-border bg-sidebar',
          collapsedClassName
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-10 w-10 text-sidebar-primary hover:text-sidebar-primary/80"
            aria-label="Expand menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-2 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Button
                key={item.href}
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(item.href);
                  onNavigate?.();
                }}
                className={cn(
                  'h-10 w-10 rounded-full text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
              </Button>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="p-2 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.displayName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.primaryEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Render expanded version
  return (
    <div
      className={cn(
        'flex h-full w-72 flex-col border-r border-sidebar-border bg-gradient-to-br from-teal-50/30 via-background to-background dark:from-teal-950/20 dark:via-background dark:to-background',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-sidebar-border p-6">
        <div className="flex items-center gap-3">
          <Image
            src="/nexary-logo-long.webp"
            alt="Nexary"
            width={152}
            height={32}
            className="h-8 w-auto dark:invert"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:flex"
            aria-label="Collapse menu"
          >
            <X className="h-4 w-4" />
          </Button>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                onClick={() => {
                  router.push(item.href);
                  onNavigate?.();
                }}
                className={cn(
                  'w-full justify-start gap-3',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                    {item.badge}
                  </span>
                )}
              </Button>

              {/* Render children if any */}
              {hasChildren && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = pathname === child.href || pathname?.startsWith(child.href + '/');

                    return (
                      <Button
                        key={child.href}
                        variant={isChildActive ? 'secondary' : 'ghost'}
                        onClick={() => {
                          router.push(child.href);
                          onNavigate?.();
                        }}
                        className={cn(
                          'w-full justify-start gap-3 text-sm',
                          isChildActive && 'bg-sidebar-accent/50 text-sidebar-accent-foreground'
                        )}
                      >
                        <ChildIcon className="w-4 h-4" />
                        <span>{child.label}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start px-2 h-12">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-sidebar-foreground">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs text-muted-foreground">{user?.primaryEmail}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
