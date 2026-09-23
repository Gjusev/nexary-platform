'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  teamSlug: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

interface DateRangePreset {
  value: string;
  label: string;
  days: number;
}

export default function AuditLogsPage() {
  const t = useTranslations('auditLogs');
  const { teamSlug, isOwner } = useTeam();
  const { toast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<string>('7d');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [action, setAction] = useState<string>('');
  const [targetType, setTargetType] = useState<string>('');

  // Export
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'syslog'>('json');
  const [exporting, setExporting] = useState(false);

  const [dateRangePresets, setDateRangePresets] = useState<DateRangePreset[]>([]);

  useEffect(() => {
    setDateRangePresets([
      { value: '24h', label: t('filters.dateRanges.24h'), days: 1 },
      { value: '7d', label: t('filters.dateRanges.7d'), days: 7 },
      { value: '30d', label: t('filters.dateRanges.30d'), days: 30 },
      { value: '90d', label: t('filters.dateRanges.90d'), days: 90 },
      { value: '1y', label: t('filters.dateRanges.1y'), days: 365 },
      { value: 'all', label: t('filters.dateRanges.all'), days: 0 },
    ]);
  }, [t]);

  const fetchLogs = async () => {
    if (!teamSlug) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        teamSlug,
        dateRange,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (action) params.append('action', action);
      if (targetType) params.append('targetType', targetType);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalCount(data.pagination?.totalCount || 0);
    } catch (error) {
      toast({
        title: t('errors.fetchFailed'),
        description: error instanceof Error ? error.message : t('errors.unknown'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [teamSlug, page, dateRange]);

  const handleExport = async () => {
    if (!teamSlug) return;

    setExporting(true);
    try {
      const params = new URLSearchParams({
        teamSlug,
        format: exportFormat,
        dateRange,
        limit: '10000',
      });

      if (action) params.append('action', action);
      if (targetType) params.append('targetType', targetType);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const response = await fetch(`/api/admin/audit-logs/export?${params}`);

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      // Get filename from headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `audit-logs.${exportFormat}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('export.success'),
        description: t('export.downloading', { filename }),
      });
    } catch (error) {
      toast({
        title: t('export.failed'),
        description: error instanceof Error ? error.message : t('errors.unknown'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionLabel = (action: string) => {
    const key = `actions.${action.replace('.', '_')}` as any;
    const translated = t(key);
    return translated !== key ? translated : action;
  };

  if (!isOwner) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">{t('accessDenied.title')}</h1>
          <p className="text-muted-foreground">{t('accessDenied.description')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Filters Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {t('filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range Preset */}
            <div className="space-y-2">
              <Label>{t('filters.dateRange.label')}</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangePresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>{t('filters.startDate.label')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : t('filters.startDate.placeholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>{t('filters.endDate.label')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : t('filters.endDate.placeholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>{t('export.formatLabel')}</Label>
              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="syslog">SYSLOG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="space-y-2">
              <Label>{t('filters.action.label')}</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t('filters.action.placeholder')}
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </div>

            {/* Target Type Filter */}
            <div className="space-y-2">
              <Label>{t('filters.targetType.label')}</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t('filters.targetType.placeholder')}
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button onClick={fetchLogs} disabled={loading} className="flex-1">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('filters.refresh')}
              </Button>
              <Button
                onClick={handleExport}
                disabled={exporting}
                variant="default"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? t('export.exporting') : t('export.button')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('logs.title')}</CardTitle>
          <CardDescription>
            {t('logs.showing', { count: logs.length, total: totalCount })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-sm">{t('logs.timestamp')}</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">{t('logs.action')}</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">{t('logs.resource')}</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">{t('logs.user')}</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">{t('logs.ipAddress')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('logs.loading')}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('logs.noLogs')}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{formatDate(log.createdAt)}</td>
                      <td className="py-3 px-4 text-sm font-mono text-xs">
                        {getActionLabel(log.action)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {log.targetType && (
                          <span>
                            {log.targetType}
                            {log.targetId && <span className="text-muted-foreground">:{log.targetId.slice(0, 8)}...</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-xs">
                        {log.actorUserId || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-xs">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {t('logs.pageInfo', {
                  page,
                  totalPages: Math.ceil(totalCount / pageSize),
                  total: totalCount,
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('logs.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                >
                  {t('logs.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('export.info.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('export.info.json')}</p>
          <p>{t('export.info.csv')}</p>
          <p>{t('export.info.syslog')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
