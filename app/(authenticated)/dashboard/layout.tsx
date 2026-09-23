'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { Menu, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeam } from '@/hooks/use-team';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('dashboard');
  const { teamSlug } = useTeam();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  useEffect(() => {
    const syncRoles = async () => {
      try {
        const response = await fetch('/api/user/sync-roles', {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Roles synchronized:', data);
        } else {
          console.warn('⚠️ Error synchronizing roles:', response.status);
        }
      } catch (error) {
        console.error('❌ Error synchronizing roles:', error);
      }
    };

    syncRoles();
  }, []);

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background">

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-dvh">
        <DashboardSidebar
          teamSlug={teamSlug || ''}
          isCollapsed={desktopSidebarCollapsed}
          onToggleCollapse={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-x-0 bottom-0 z-40 bg-black/40"
            style={{ top: 0, bottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div
            className="fixed left-0 z-50 flex w-full max-w-[80vw]"
            style={{
              top: 0,
              bottom: 'env(safe-area-inset-bottom, 0px)',
              height: '100dvh',
            }}
          >
            <DashboardSidebar
              teamSlug={teamSlug || ''}
              className="w-full rounded-r-3xl border-r border-border bg-sidebar shadow-2xl"
              showCloseButton
              onClose={() => setMobileSidebarOpen(false)}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Expand button when sidebar is collapsed (mobile only) */}
        {desktopSidebarCollapsed && (
          <Button
            onClick={() => setDesktopSidebarCollapsed(false)}
            size="icon"
            className="absolute top-4 left-4 z-10 rounded-full shadow-lg lg:hidden"
            variant="default"
            title={t('expandMenu')}
          >
            <ChevronLeft className="h-5 w-5 rotate-180" />
          </Button>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>

      {!mobileSidebarOpen && (
        <Button
          onClick={() => setMobileSidebarOpen(true)}
          size="icon"
          className="fixed bottom-4 left-4 z-40 rounded-full shadow-lg lg:hidden"
          aria-label={t('openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
