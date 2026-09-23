/**
 * Admin SCIM Configuration Page
 *
 * SCIM 2.0 configuration page for a specific team.
 * Displays SCIM tokens and sync logs.
 */

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { AdminSCIMConfig } from '@/components/admin/teams/admin-scim-config';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const metadata = {
  title: 'SCIM Configuration',
  description: 'Manage SCIM 2.0 provisioning for this team',
};

async function getTeam(teamSlug: string) {
  const result = await query(
    `SELECT id, name, slug FROM projectnexus.teams WHERE slug = $1`,
    [teamSlug]
  );

  return result.rows[0] || null;
}

export default async function AdminTeamSCIMPage(props: PageProps) {
  const { locale, slug } = await props.params;
  const t = await getTranslations('admin.scim');

  const team = await getTeam(slug);

  if (!team) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <a href="/dashboard/admin/teams" className="hover:text-foreground">
              {t('backToTeams')}
            </a>
            <span>/</span>
            <span>{team.slug}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
        <a
          href={`/dashboard/admin/teams/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t('viewTeam')}
        </a>
      </div>

      {/* SCIM Config Component */}
      <Suspense fallback={<SCIMConfigSkeleton />}>
        <AdminSCIMConfig teamSlug={slug} teamName={team.name} />
      </Suspense>
    </div>
  );
}

function SCIMConfigSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-32 w-full bg-muted animate-pulse rounded-lg" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
