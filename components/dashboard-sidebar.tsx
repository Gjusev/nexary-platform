'use client';

import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type DashboardNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

interface DashboardSidebarProps {
  title: string;
  items: DashboardNavItem[];
  className?: string;
  collapsedClassName?: string;
  onNavigate?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DashboardSidebar({
  title,
  items,
  className,
  collapsedClassName,
  onNavigate,
  onClose,
  showCloseButton,
  isCollapsed = false,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Simple translation function for sidebar labels
  const t = useTranslations('sidebar');

  if (isCollapsed) {
    return (
      <div
        className={cn(
          'flex h-full w-16 flex-col border-r border-sidebar-border bg-sidebar',
          collapsedClassName
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse?.()}
            className="h-10 w-10 text-sidebar-primary hover:text-sidebar-primary/80"
            aria-label={t('expandMenu')}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-2 py-4">
          {items.map((item) => {
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
                aria-label={item.title}
              >
                <Icon className="h-5 w-5" />
              </Button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-72 flex-col border-r border-sidebar-border bg-gradient-to-br from-teal-50/30 via-background to-background dark:from-teal-950/20 dark:via-background dark:to-background',
        className
      )}
    >
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
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleCollapse()}
              className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:flex"
              aria-label={t('collapseMenu')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 lg:hidden"
              aria-label={t('closeMenu')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Button
              key={item.href}
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
              <span>{item.title}</span>
              {item.badge && (
                <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                  {item.badge}
                </span>
              )}
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
