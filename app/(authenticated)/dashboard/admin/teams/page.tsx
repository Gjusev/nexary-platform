/**
 * Admin Teams Page
 *
 * Lists all teams with their SSO/SCIM configuration status.
 * Provides search and filtering capabilities.
 */

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminTeamsTable } from '@/components/admin/teams/admin-teams-table';

export const metadata = {
  title: 'Teams Management',
  description: 'Manage all teams and their enterprise authentication settings',
};

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminTeamsPage(props: PageProps) {
  const { locale } = await props.params;
  const t = await getTranslations('admin.teams');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
      </div>

      <Suspense fallback={<TeamsTableSkeleton />}>
        <AdminTeamsTable />
      </Suspense>
    </div>
  );
}

function TeamsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full bg-muted animate-pulse rounded" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-muted animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}
