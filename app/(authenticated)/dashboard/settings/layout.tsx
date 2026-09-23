'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  User,
  Shield,
  Bell,
  Monitor,
  Settings as SettingsIcon,
  KeyRound,
  FileCheck,
  Users,
  Network,
  Lock,
  Eye,
} from 'lucide-react';

interface NavItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const accountNavItems: NavSection[] = [
  {
    title: 'navSectionAccount',
    items: [
      {
        key: 'profile',
        icon: User,
        href: '/dashboard/settings/profile',
      },
      {
        key: 'auth',
        icon: Shield,
        href: '/dashboard/settings/auth',
      },
      {
        key: 'sessions',
        icon: Monitor,
        href: '/dashboard/settings/sessions',
      },
    ],
  },
  {
    title: 'navSectionPreferences',
    items: [
      {
        key: 'notifications',
        icon: Bell,
        href: '/dashboard/settings/notifications',
      },
      {
        key: 'preferences',
        icon: SettingsIcon,
        href: '/dashboard/settings/preferences',
      },
      {
        key: 'privacy',
        icon: Lock,
        href: '/dashboard/settings/privacy',
      },
    ],
  },
  {
    title: 'navSectionSecurity',
    items: [
      {
        key: 'apiKeys',
        icon: KeyRound,
        href: '/dashboard/settings/api-keys',
      },
      {
        key: 'auditLogs',
        icon: FileCheck,
        href: '/dashboard/settings/audit-logs',
      },
    ],
  },
  {
    title: 'navSectionTeam',
    items: [
      {
        key: 'sso',
        icon: Network,
        href: '/dashboard/settings/sso',
      },
      {
        key: 'scim',
        icon: Users,
        href: '/dashboard/settings/scim',
      },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations('settings.layout');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {t('title')}
          </h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 space-y-4">
            {accountNavItems.map((section) => (
              <div key={section.title} className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    {t(section.title)}
                  </h3>
                </div>
                <nav className="p-2 space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                          ${
                            isActive
                              ? 'bg-muted text-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted/50'
                          }
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        {t(`nav.${item.key}`)}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="bg-card rounded-lg border border-border">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
