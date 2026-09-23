/**
 * Monitoring Dashboard
 *
 * Provides real-time visibility into system health, performance metrics,
 * and business KPIs. Admin-only access.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Database,
  HardDrive,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: { status: string; latency?: number; error?: string };
    redis: { status: string; latency?: number; error?: string };
    storage: { status: string; latency?: number; error?: string };
    qdrant: { status: string; latency?: number; error?: string };
  };
  metrics: {
    memory: NodeJS.MemoryUsage;
    cpu: { usage: number };
  };
}

export default function MonitoringDashboard() {
  const t = useTranslations('monitoring');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch health status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500">{t('healthy')}</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-500">{t('unhealthy')}</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">{t('degraded')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t('noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHealth()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t('refresh')}
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('systemHealth')}</CardTitle>
              <CardDescription>
                {t('lastChecked')}: {new Date(health.timestamp).toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(health.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium">{t('uptime')}</p>
                <p className="text-2xl font-bold">{formatUptime(health.uptime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Cpu className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium">{t('cpuUsage')}</p>
                <p className="text-2xl font-bold">{health.metrics.cpu.usage.toFixed(2)}s</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <HardDrive className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t('memoryUsage')}</p>
                <p className="text-2xl font-bold">{formatBytes(health.metrics.memory.heapUsed)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t('serviceStatus')}</CardTitle>
          <CardDescription>{t('serviceStatusDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Database */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">{t('database')}</p>
                  {health.checks.database.latency && (
                    <p className="text-sm text-muted-foreground">
                      {t('latency')}: {health.checks.database.latency}ms
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.checks.database.status)}
                {getStatusBadge(health.checks.database.status)}
              </div>
            </div>

            {/* Redis */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium">Redis</p>
                  {health.checks.redis.latency && (
                    <p className="text-sm text-muted-foreground">
                      {t('latency')}: {health.checks.redis.latency}ms
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.checks.redis.status)}
                {getStatusBadge(health.checks.redis.status)}
              </div>
            </div>

            {/* Storage */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{t('storage')}</p>
                  {health.checks.storage.latency && (
                    <p className="text-sm text-muted-foreground">
                      {t('latency')}: {health.checks.storage.latency}ms
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.checks.storage.status)}
                {getStatusBadge(health.checks.storage.status)}
              </div>
            </div>

            {/* Qdrant */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">Qdrant</p>
                  {health.checks.qdrant.latency && (
                    <p className="text-sm text-muted-foreground">
                      {t('latency')}: {health.checks.qdrant.latency}ms
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.checks.qdrant.status)}
                {getStatusBadge(health.checks.qdrant.status)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-refresh toggle */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('autoRefresh')}</p>
              <p className="text-sm text-muted-foreground">{t('autoRefreshDescription')}</p>
            </div>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? t('enabled') : t('disabled')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
