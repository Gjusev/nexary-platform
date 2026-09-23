'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Loader2, AlertTriangle, X, Activity } from 'lucide-react';
import { AnalyticsCardSkeleton, AnalyticsTopListSkeleton } from '@/components/chat-skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';

type Payload = {
  period: string;
  limits: { queries: number; docsProcessed: number; members: number; rags: number };
  usage: { queries: number; docsProcessed: number; members?: number; rags?: number };
};

type PeriodOption = '24h' | '7d' | '30d' | 'month' | 'all' | 'custom';

type CostAnalyticsResponse = {
  success: boolean;
  analytics?: {
    totalSpend: number;
    totalRequests: number;
    totalTokens: number;
    byProvider: Array<{ provider: string; spend: number; requests: number }>;
    byModel: Array<{ model: string; provider: string; spend: number; requests: number; avgTokens: number }>;
    dailySpend: Array<{ date: string; spend: number; requests: number }>;
  };
  settings?: {
    monthlyBudgetUsd?: number;
    currentMonthlySpendUsd: number;
    alertThresholdPercentage: number;
    currentMonthStartDate: Date;
    budgetPercentage: number;
    budgetStatus: 'ok' | 'warning' | 'exceeded';
  } | null;
  alerts?: Array<{
    id: string;
    alertType: string;
    percentageUsed: number;
    monthlySpendUsd: number;
    budgetUsd: number;
    createdAt: Date;
  }>;
  error?: string;
};

const CHART_COLORS = {
  openai: '#10a37f',
  anthropic: '#D97757',
  gemini: '#4285F4',
  mistral: '#F7931E',
  other: '#64748b',
};

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

export default function TeamAnalyticsPage() {
  const t = useTranslations('dashboard');
  const { toast } = useToast();
  const { roles, isLoading, teamSlug } = useTeam();
  const [data, setData] = useState<Payload | null>(null);
  const [tops, setTops] = useState<{ topRags: { ragId: string; name: string; count: number }[]; topUsers: { userId: string; display?: string; count: number }[] } | null>(null);
  const [periodOption, setPeriodOption] = useState<PeriodOption>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<{ userId: string; name: string; email: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cost Analytics State
  const [costData, setCostData] = useState<CostAnalyticsResponse | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(true);
  const [costDays, setCostDays] = useState(30);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [newAlertThreshold, setNewAlertThreshold] = useState('80');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const period = useMemo(() => {
    return getPeriodString(periodOption, customStartDate, customEndDate);
  }, [periodOption, customStartDate, customEndDate]);

  const normalizedRoles = useMemo(
    () => (roles ?? []).map((role: string) => role.toLowerCase().replace(/-/g, '_')),
    [roles],
  );
  const canView = normalizedRoles.some((role) =>
    ['team_leader', 'team_owner', 'team_admin', 'global_admin'].includes(role),
  );

  // Cargar miembros del equipo
  useEffect(() => {
    if (isLoading || !canView || !teamSlug) return;
    (async () => {
      const res = await fetch(`/api/team/members`);
      if (res.ok) {
        const members = await res.json();
        setTeamMembers(members.members || []);
      }
    })();
  }, [canView, isLoading, teamSlug]);

  useEffect(() => {
    if (isLoading || !canView || !teamSlug) return;
    setLoadingData(true);
    (async () => {
      const url = filterUserId 
        ? `/api/team/analytics?period=${encodeURIComponent(period)}&userId=${encodeURIComponent(filterUserId)}`
        : `/api/team/analytics?period=${encodeURIComponent(period)}`;
      const res = await fetch(url);
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      } else {
        console.error('Error loading analytics:', res.status, res.statusText);
      }
      setLoadingData(false);
    })();
  }, [canView, isLoading, period, teamSlug, filterUserId]);

  useEffect(() => {
    if (isLoading) return;
    console.log('Team roles resolved for analytics access:', {
      original: roles,
      normalized: normalizedRoles,
      canView,
    });
  }, [canView, isLoading, normalizedRoles, roles]);

  useEffect(() => {
    if (!canView || !teamSlug) return;
    (async () => {
      const url = filterUserId
        ? `/api/team/analytics/breakdown?period=${encodeURIComponent(period)}&userId=${encodeURIComponent(filterUserId)}`
        : `/api/team/analytics/breakdown?period=${encodeURIComponent(period)}`;
      const res = await fetch(url);
      if (res.ok) {
        const payload = await res.json();
        setTops({ topRags: payload.topRags || [], topUsers: payload.topUsers || [] });
      } else {
        console.error('Error loading breakdown:', res.status, res.statusText);
      }
    })();
  }, [canView, isLoading, period, teamSlug, filterUserId]);

  // Load Cost Analytics
  useEffect(() => {
    if (!canView || !teamSlug) return;
    setLoadingCosts(true);
    (async () => {
      try {
        const res = await fetch(`/api/team/cost-analytics?days=${costDays}`);
        const payload: CostAnalyticsResponse = await res.json();
        if (payload.success) {
          setCostData(payload);
          if (payload.settings) {
            setNewBudget(payload.settings.monthlyBudgetUsd?.toString() || '');
            setNewAlertThreshold(payload.settings.alertThresholdPercentage.toString());
          }
        } else {
          console.error('Error loading cost analytics:', payload.error);
        }
      } catch (error) {
        console.error('Error loading cost analytics:', error);
      } finally {
        setLoadingCosts(false);
      }
    })();
  }, [canView, teamSlug, costDays]);

  // Handlers for budget settings
  const handleSaveBudgetSettings = async () => {
    try {
      setIsSavingSettings(true);
      const res = await fetch('/api/team/cost-analytics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyBudgetUsd: newBudget ? parseFloat(newBudget) : null,
          alertThresholdPercentage: newAlertThreshold ? parseInt(newAlertThreshold) : 80,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Configuración guardada',
          description: 'Los ajustes de presupuesto se han actualizado',
        });
        setShowBudgetSettings(false);
        // Reload cost data
        const costRes = await fetch(`/api/team/cost-analytics?days=${costDays}`);
        const costPayload: CostAnalyticsResponse = await costRes.json();
        if (costPayload.success) {
          setCostData(costPayload);
        }
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving budget settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/team/cost-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });

      const data = await res.json();
      if (data.success) {
        setCostData((prev) => ({
          ...prev!,
          alerts: prev?.alerts?.filter((a) => a.id !== alertId) || [],
        }));
        toast({
          title: 'Alerta descartada',
          description: 'La alerta ha sido eliminada',
        });
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  if (isLoading) return null;
  
  if (!canView) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('restrictedAccess')}</CardTitle>
          <CardDescription>{t('onlyOwnerLeader')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  if (!teamSlug) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('noActiveTeam')}</CardTitle>
          <CardDescription>{t('mustBelongToTeam')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  if (loadingData) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('teamAnalytics')}</h1>
            <p className="text-sm text-muted-foreground">{t('usageAndStats')}</p>
          </div>
        </div>
        
        <AnalyticsCardSkeleton />
        
        <div className="grid md:grid-cols-2 gap-4">
          <AnalyticsTopListSkeleton count={3} />
          <AnalyticsTopListSkeleton count={3} />
        </div>
      </div>
    );
  }

  if (!data || !tops) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analíticas del Equipo</h1>
          <p className="text-sm text-muted-foreground">Uso, estadísticas y costos de IA</p>
        </div>
      </div>

      <Tabs defaultValue="usage" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="usage">Uso</TabsTrigger>
          <TabsTrigger value="costs">Costos de IA</TabsTrigger>
        </TabsList>

        {/* USAGE ANALYTICS TAB */}
        <TabsContent value="usage" className="space-y-6">
          {/* Period Selector - Only for usage tab */}
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
                    <label className="text-sm font-medium">{t('filterUser')}:</label>
                    <Select value={filterUserId || 'all'} onValueChange={(value) => setFilterUserId(value === 'all' ? '' : value)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder={t('allUsers')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allUsers')}</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.userId} value={member.userId}>
                            {member.name || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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

          {data && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('queries')}</span>
                    <span>{data.usage.queries}/{data.limits.queries}</span>
                  </div>
                  <Progress value={data.usage.queries} max={data.limits.queries} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('docsProcessed')}</span>
                    <span>{data.usage.docsProcessed}/{data.limits.docsProcessed}</span>
                  </div>
                  <Progress value={data.usage.docsProcessed} max={data.limits.docsProcessed} />
                </div>
              </CardContent>
            </Card>
          )}

          {tops && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('topRags')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {tops.topRags.map((r) => (
                    <div key={r.ragId} className="flex items-center justify-between border rounded p-2">
                      <div>{r.name || r.ragId}</div>
                      <div className="text-muted-foreground">{r.count}</div>
                    </div>
                  ))}
                  {tops.topRags.length === 0 && <div className="text-muted-foreground">{t('noData')}</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t('topUsers')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {tops.topUsers.map((u) => (
                    <div key={u.userId} className="flex items-center justify-between border rounded p-2">
                      <div>{u.display || u.userId}</div>
                      <div className="text-muted-foreground">{u.count}</div>
                    </div>
                  ))}
                  {tops.topUsers.length === 0 && <div className="text-muted-foreground">{t('noData')}</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* COST ANALYTICS TAB */}
        <TabsContent value="costs" className="space-y-6">
          {loadingCosts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : costData?.analytics ? (
            <>
              {/* Budget Alerts */}
              {costData.alerts && costData.alerts.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                          Alerta de Presupuesto
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Has alcanzado el {costData.alerts?.[0]?.percentageUsed || 0}% de tu presupuesto mensual
                          (${costData.alerts?.[0]?.monthlySpendUsd.toFixed(2) || '0.00'} de ${costData.alerts?.[0]?.budgetUsd.toFixed(2) || '0.00'})
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => costData.alerts?.[0] && handleDismissAlert(costData.alerts[0].id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Gasto Total ({costDays} días)</CardDescription>
                    <CardTitle className="text-2xl">
                      ${costData.analytics.totalSpend.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <DollarSign className="w-3 h-3 mr-1" />
                      Costo acumulado de IA
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Requests</CardDescription>
                    <CardTitle className="text-2xl">
                      {costData.analytics.totalRequests.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Total de consultas
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Tokens</CardDescription>
                    <CardTitle className="text-2xl">
                      {(costData.analytics.totalTokens / 1000000).toFixed(2)}M
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Activity className="w-3 h-3 mr-1" />
                      Tokens procesados
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Promedio/Request</CardDescription>
                    <CardTitle className="text-2xl">
                      ${(costData.analytics.totalSpend / costData.analytics.totalRequests || 0).toFixed(4)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Costo por consulta
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Status */}
              {costData.settings && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Presupuesto Mensual</CardTitle>
                        <CardDescription>Seguimiento del presupuesto actual</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowBudgetSettings(!showBudgetSettings)}>
                        {showBudgetSettings ? 'Cerrar' : 'Configurar'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {costData.settings.monthlyBudgetUsd ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span>Gasto actual</span>
                            <span className="font-medium">
                              ${costData.settings.currentMonthlySpendUsd.toFixed(2)} de ${costData.settings.monthlyBudgetUsd.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                costData.settings.budgetStatus === 'exceeded'
                                  ? 'bg-red-500'
                                  : costData.settings.budgetStatus === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, costData.settings.budgetPercentage)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>{costData.settings.budgetPercentage.toFixed(1)}% utilizado</span>
                            <Badge
                              variant={
                                costData.settings.budgetStatus === 'exceeded'
                                  ? 'destructive'
                                  : costData.settings.budgetStatus === 'warning'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {costData.settings.budgetStatus === 'exceeded'
                                ? 'Excedido'
                                : costData.settings.budgetStatus === 'warning'
                                ? 'Alerta'
                                : 'OK'}
                            </Badge>
                          </div>
                        </div>

                        {showBudgetSettings && (
                          <div className="border-t pt-4 space-y-4">
                            <div className="space-y-2">
                              <Label>Presupuesto Mensual (USD)</Label>
                              <Input
                                type="number"
                                value={newBudget}
                                onChange={(e) => setNewBudget(e.target.value)}
                                placeholder="Ej: 100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Alerta al alcanzar (%)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={newAlertThreshold}
                                onChange={(e) => setNewAlertThreshold(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleSaveBudgetSettings} disabled={isSavingSettings} size="sm">
                                {isSavingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Guardar
                              </Button>
                              <Button variant="outline" onClick={() => setShowBudgetSettings(false)} size="sm">
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-4">No has configurado un presupuesto mensual</p>
                        {showBudgetSettings ? (
                          <div className="max-w-sm mx-auto space-y-4 text-left">
                            <div className="space-y-2">
                              <Label>Presupuesto Mensual (USD)</Label>
                              <Input
                                type="number"
                                value={newBudget}
                                onChange={(e) => setNewBudget(e.target.value)}
                                placeholder="Ej: 100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Alerta al alcanzar (%)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={newAlertThreshold}
                                onChange={(e) => setNewAlertThreshold(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleSaveBudgetSettings} disabled={isSavingSettings} size="sm">
                                {isSavingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Guardar
                              </Button>
                              <Button variant="outline" onClick={() => setShowBudgetSettings(false)} size="sm">
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="outline" onClick={() => setShowBudgetSettings(true)} size="sm">
                            Configurar Presupuesto
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Spend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Gasto Diario</CardTitle>
                    <CardDescription>Gastos de IA por día</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {costData.analytics.dailySpend.length > 0 ? (
                      <ChartContainer
                        config={{
                          spend: {
                            label: 'Gasto',
                            color: 'hsl(var(--chart-2))',
                          },
                        }}
                        className="h-[250px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={costData.analytics.dailySpend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(v) => new Date(v).toLocaleDateString('es', { day: '2-digit', month: '2-digit' })}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="spend" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground py-8">No hay datos disponibles</div>
                    )}
                  </CardContent>
                </Card>

                {/* Spend by Provider */}
                <Card>
                  <CardHeader>
                    <CardTitle>Gasto por Proveedor</CardTitle>
                    <CardDescription>Distribución de costos por IA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {costData.analytics.byProvider.length > 0 ? (
                      <ChartContainer
                        config={{
                          ...Object.fromEntries(
                            costData.analytics.byProvider.map((p) => [
                              p.provider,
                              { label: p.provider, color: CHART_COLORS[p.provider as keyof typeof CHART_COLORS] || CHART_COLORS.other },
                            ])
                          ),
                        }}
                        className="h-[250px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={costData.analytics.byProvider}
                              dataKey="spend"
                              nameKey="provider"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={(entry) => `$${entry.spend.toFixed(2)}`}
                            >
                              {costData.analytics.byProvider.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={CHART_COLORS[entry.provider as keyof typeof CHART_COLORS] || CHART_COLORS.other}
                                />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground py-8">No hay datos disponibles</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Cost by Model Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Costos por Modelo</CardTitle>
                  <CardDescription>Desglose detallado de gastos por modelo</CardDescription>
                </CardHeader>
                <CardContent>
                  {costData.analytics.byModel.length > 0 ? (
                    <div className="rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50 dark:bg-slate-900">
                            <th className="text-left p-3 font-medium">Modelo</th>
                            <th className="text-left p-3 font-medium">Proveedor</th>
                            <th className="text-right p-3 font-medium">Gasto</th>
                            <th className="text-right p-3 font-medium">Requests</th>
                            <th className="text-right p-3 font-medium">Promedio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costData.analytics.byModel.map((model) => (
                            <tr key={model.model} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900">
                              <td className="p-3 font-medium">{model.model}</td>
                              <td className="p-3">
                                <Badge variant="outline">{model.provider}</Badge>
                              </td>
                              <td className="text-right p-3">${model.spend.toFixed(2)}</td>
                              <td className="text-right p-3">{model.requests.toLocaleString()}</td>
                              <td className="text-right p-3">${(model.spend / model.requests || 0).toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">No hay datos disponibles</div>
                  )}
                </CardContent>
              </Card>

              {/* Time Range Selector */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={costDays === 7 ? 'default' : 'ghost'}
                    onClick={() => setCostDays(7)}
                  >
                    7 días
                  </Button>
                  <Button
                    size="sm"
                    variant={costDays === 30 ? 'default' : 'ghost'}
                    onClick={() => setCostDays(30)}
                  >
                    30 días
                  </Button>
                  <Button
                    size="sm"
                    variant={costDays === 90 ? 'default' : 'ghost'}
                    onClick={() => setCostDays(90)}
                  >
                    90 días
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <DollarSign className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sin datos de costos</h3>
                <p className="text-sm text-slate-500">
                  Los costos de IA se registrarán a partir de tu primera consulta
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
