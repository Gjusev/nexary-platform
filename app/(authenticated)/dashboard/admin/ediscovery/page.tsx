'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@stackframe/stack';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, FileText, Database, FileClock, Filter, Loader2 } from 'lucide-react';

type ResourceType = 'chat_messages' | 'documents' | 'audit_logs' | 'consents' | 'api_keys';

interface EDiscoveryResult {
  type: ResourceType;
  id: string;
  teamSlug?: string;
  userId?: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
}

interface EDiscoverySummary {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  dateRange: { earliest: string; latest: string };
  uniqueUsers: number;
  uniqueTeams: number;
}

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  chat_messages: 'Chat Messages',
  documents: 'Documents',
  audit_logs: 'Audit Logs',
  consents: 'Consents',
  api_keys: 'API Keys',
};

export default function EDiscoveryPage() {
  const t = useTranslations('admin.ediscovery');
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<EDiscoveryResult[]>([]);
  const [summary, setSummary] = useState<EDiscoverySummary | null>(null);

  // Search filters
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>(['chat_messages', 'documents', 'audit_logs']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ediscovery?summary=true');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to load eDiscovery summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({
        query,
        resourceTypes: selectedTypes.join(','),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        limit: '100',
      });

      const res = await fetch(`/api/admin/ediscovery?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        query,
        resourceTypes: selectedTypes.join(','),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        export: exportFormat,
      });

      const res = await fetch(`/api/admin/ediscovery?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ediscovery-${Date.now()}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const toggleType = (type: ResourceType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const getTypeColor = (type: ResourceType) => {
    const colors: Record<ResourceType, string> = {
      chat_messages: 'bg-blue-500',
      documents: 'bg-green-500',
      audit_logs: 'bg-purple-500',
      consents: 'bg-yellow-500',
      api_keys: 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button onClick={loadSummary} variant="outline" size="sm">
          {t('refresh')}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && !loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.totalDocuments')}</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalDocuments.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.uniqueUsers')}</CardTitle>
              <FileClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.uniqueUsers.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.uniqueTeams')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.uniqueTeams.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.dateRange')}</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div>{new Date(summary.dateRange.earliest).toLocaleDateString()}</div>
                <div className="text-muted-foreground">{t('to')}</div>
                <div>{new Date(summary.dateRange.latest).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('search.title')}</CardTitle>
          <CardDescription>{t('search.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={t('search.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searching || !query}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t('search.button')}
            </Button>
          </div>

          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Resource Types */}
            <div className="space-y-2">
              <Label>{t('filters.resourceTypes')}</Label>
              <div className="space-y-1">
                {Object.entries(RESOURCE_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type as ResourceType)}
                      onCheckedChange={() => toggleType(type as ResourceType)}
                    />
                    <label htmlFor={type} className="text-sm cursor-pointer">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t('filters.dateRange')}</Label>
              <div className="space-y-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>{t('filters.exportFormat')}</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'json' | 'csv')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Button */}
            <div className="space-y-2">
              <Label>{t('filters.actions')}</Label>
              <Button onClick={handleExport} disabled={!results.length} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                {t('export.button')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('results.title')}</CardTitle>
            <CardDescription>
              {t('results.count', { count: results.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${getTypeColor(result.type)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{RESOURCE_TYPE_LABELS[result.type]}</Badge>
                      {result.teamSlug && (
                        <Badge variant="secondary" className="text-xs">
                          {result.teamSlug}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{result.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && query && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t('noResults')}</p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('info.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 dark:text-blue-100 space-y-2">
          <p>{t('info.line1')}</p>
          <p>{t('info.line2')}</p>
          <p>{t('info.line3')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
