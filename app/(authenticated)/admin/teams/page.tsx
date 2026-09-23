'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type Team = { id: string; slug: string; name: string; description?: string | null };

export default function AdminTeamsPage() {
  const t = useTranslations('admin');
  const { roles, isLoading, status } = useTeam();
  const [teams, setTeams] = useState<Team[]>([]);
  const isGlobal = roles.some((r: string) => r === 'global-admin');

  useEffect(() => {
    if (!isGlobal) return;
    (async () => {
      const res = await fetch('/api/admin/teams');
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    })();
  }, [isGlobal]);

  if (isLoading || status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isGlobal) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accessDenied')}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('teams')}</h1>
        <p className="text-sm text-muted-foreground">{t('teamsDescription')}</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {teams.map(t => (
            <div key={t.id} className="border rounded p-3">
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.slug}</div>
              {t.description && <div className="text-sm">{t.description}</div>}
            </div>
          ))}
          {teams.length === 0 && <div className="text-sm text-muted-foreground">{t('noTeams')}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
