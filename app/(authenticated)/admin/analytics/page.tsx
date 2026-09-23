'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

type TeamRow = {
  teamSlug: string;
  name: string;
  planId: string;
  limits: { queries: number; docsProcessed: number; rags: number; members: number };
  usage: { queries: number; docsProcessed: number; rags?: number; members?: number };
};

type PeriodOption = '24h' | '7d' | '30d' | 'month' | 'all' | 'custom';

function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / (max || 1)) * 100)));
  return (
    <div className="w-full h-2 bg-muted rounded">
      <div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} />
    </div>
  );
}

function getPeriodString(option: PeriodOption, customStart?: string, customEnd?: string): string {
  const now = new Date();
  
  switch (option) {
    case '24h': {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return `${start.toISOString()}|${now.toISOString()}`;
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return `${start.toISOString()}|${now.toISOString()}`;
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return `${start.toISOString()}|${now.toISOString()}`;
    }
    case 'month': {
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    case 'all':
      return 'all';
    case 'custom':
      if (customStart && customEnd) {
        return `${customStart}|${customEnd}`;
      }
      return getPeriodString('month');
    default:
      return getPeriodString('month');
  }
}

export default function AdminAnalyticsPage() {
  const t = useTranslations('admin');
  const { roles, isLoading } = useTeam();
  const isGlobal = roles.includes('global-admin');
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [teamSlug, setTeamSlug] = useState<string>('');
  const [breakdown, setBreakdown] = useState<{ topTeams?: { team_slug: string; c: string }[]; topRags?: { rag_id: string; name: string; c: string }[]; topUsers?: { user_id: string; c: string }[] } | null>(null);
  const [periodOption, setPeriodOption] = useState<PeriodOption>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const period = useMemo(() => {
    return getPeriodString(periodOption, customStartDate, customEndDate);
  }, [periodOption, customStartDate, customEndDate]);

  useEffect(() => {
    if (!isGlobal) return;
    (async () => {
      const res = await fetch(`/api/admin/analytics/teams?period=${encodeURIComponent(period)}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.teams || []);
      }
    })();
  }, [isGlobal, period]);

  useEffect(() => {
    if (!isGlobal) return;
    const url = teamSlug
      ? `/api/admin/analytics/breakdown?period=${encodeURIComponent(period)}&teamSlug=${encodeURIComponent(teamSlug)}`
      : `/api/admin/analytics/breakdown?period=${encodeURIComponent(period)}`;
    (async () => {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBreakdown(data);
      }
    })();
  }, [isGlobal, period, teamSlug]);

  if (isLoading) return null;
  if (!isGlobal) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accessDenied')}</CardTitle>
          <CardDescription>{t('requiresGlobalAdmin')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('globalAnalytics')}</h1>
            <p className="text-sm text-muted-foreground">{t('usageByTeamsSelectedPeriod')}</p>
          </div>
        </div>
        
        {/* Selector de período y filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">{t('period')}:</label>
                </div>
                <Select value={periodOption} onValueChange={(value: PeriodOption) => setPeriodOption(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('selectPeriod')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">{t('last24h')}</SelectItem>
                    <SelectItem value="7d">{t('last7d')}</SelectItem>
                    <SelectItem value="30d">{t('last30d')}</SelectItem>
                    <SelectItem value="month">{t('currentMonth')}</SelectItem>
                    <SelectItem value="all">{t('allTime')}</SelectItem>
                    <SelectItem value="custom">{t('customRange')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-2 ml-4">
                  <label className="text-sm font-medium">{t('filterTeam')}:</label>
                  <input
                    className="border rounded h-9 px-3 text-sm w-[200px]"
                    value={teamSlug}
                    onChange={(e) => setTeamSlug(e.target.value)}
                    placeholder={t('teamSlugPlaceholder')}
                  />
                </div>
              </div>
              
              {/* Selector de fechas personalizado */}
              {periodOption === 'custom' && (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">{t('from')}:</label>
                    <input
                      type="date"
                      className="border rounded h-9 px-3 text-sm"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">{t('to')}:</label>
                    <input
                      type="date"
                      className="border rounded h-9 px-3 text-sm"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {rows.map((r) => (
            <div key={r.teamSlug} className="border rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.teamSlug} · {t('plan')} {r.planId}</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span>{t('queries')}</span>
                    <span>
                      {r.usage.queries}/{r.limits.queries}
                    </span>
                  </div>
                  <Progress value={r.usage.queries} max={r.limits.queries} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span>{t('docsProcessed')}</span>
                    <span>
                      {r.usage.docsProcessed}/{r.limits.docsProcessed}
                    </span>
                  </div>
                  <Progress value={r.usage.docsProcessed} max={r.limits.docsProcessed} />
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-muted-foreground">{t('noData')}</div>}
        </CardContent>
      </Card>

      {breakdown && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{teamSlug ? t('topRagsTeam') : t('topRagsGlobal')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(breakdown.topRags || []).map((r) => (
                <div key={r.rag_id} className="flex items-center justify-between border rounded p-2">
                  <div>{r.name || r.rag_id}</div>
                  <div className="text-muted-foreground">{r.c}</div>
                </div>
              ))}
              {(!breakdown.topRags || breakdown.topRags.length === 0) && <div className="text-muted-foreground">{t('noData')}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{teamSlug ? t('topUsersTeam') : t('topTeamsGlobal')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {teamSlug
                ? (breakdown.topUsers || []).map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between border rounded p-2">
                      <div>{u.user_id}</div>
                      <div className="text-muted-foreground">{u.c}</div>
                    </div>
                  ))
                : (breakdown.topTeams || []).map((t) => (
                    <div key={t.team_slug} className="flex items-center justify-between border rounded p-2">
                      <div>{t.team_slug}</div>
                      <div className="text-muted-foreground">{t.c}</div>
                    </div>
                  ))}
              {teamSlug && (!breakdown.topUsers || breakdown.topUsers.length === 0) && (
                <div className="text-muted-foreground">{t('noData')}</div>
              )}
              {!teamSlug && (!breakdown.topTeams || breakdown.topTeams.length === 0) && (
                <div className="text-muted-foreground">{t('noData')}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
