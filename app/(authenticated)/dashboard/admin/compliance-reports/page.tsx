'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@stackframe/stack';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Calendar,
  Shield,
  CheckCircle,
  Clock,
  Loader2,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';

type ComplianceFramework = 'gdpr' | 'soc2' | 'hipaa';
type ReportPeriod = 'monthly' | 'quarterly' | 'annual';

interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  generatedAt: string;
  generatedBy: string;
}

const FRAMEWORK_INFO = {
  gdpr: {
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    description: 'EU data protection and privacy regulation',
    icon: Shield,
    color: 'bg-blue-500',
  },
  soc2: {
    name: 'SOC 2',
    fullName: 'Service Organization Control 2',
    description: 'Security and compliance audit framework',
    icon: CheckCircle,
    color: 'bg-green-500',
  },
  hipaa: {
    name: 'HIPAA',
    fullName: 'Health Insurance Portability and Accountability Act',
    description: 'US healthcare data protection regulation',
    icon: FileText,
    color: 'bg-purple-500',
  },
};

export default function ComplianceReportsPage() {
  const t = useTranslations('admin.complianceReports');
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<ComplianceReport[]>([]);

  // Report generation form
  const [framework, setFramework] = useState<ComplianceFramework>('gdpr');
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(1);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'list',
        limit: '50',
      });

      const res = await fetch(`/api/admin/compliance/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body: any = {
        framework,
        year,
      };

      if (framework === 'gdpr' || framework === 'hipaa') {
        body.month = month;
      }

      if (framework === 'soc2') {
        body.period = period;
        if (period === 'quarterly') {
          body.quarter = quarter;
        }
      }

      const res = await fetch('/api/admin/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await loadReports();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Generate report error:', error);
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId: string, format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams({
        action: 'get',
        reportId,
        format,
      });

      const res = await fetch(`/api/admin/compliance/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-report-${reportId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download report error:', error);
      alert('Failed to download report');
    }
  };

  const handleGenerateAndDownload = async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        action: 'generate',
        framework,
        year: year.toString(),
        format: exportFormat,
      });

      if (framework === 'gdpr' || framework === 'hipaa') {
        params.append('month', month.toString());
      }

      if (framework === 'soc2') {
        params.append('period', period);
        if (period === 'quarterly') {
          params.append('quarter', quarter.toString());
        }
      }

      const res = await fetch(`/api/admin/compliance/reports?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-${framework}-${Date.now()}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        await loadReports();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Generate and download error:', error);
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Reports</h1>
          <p className="text-muted-foreground mt-1">Generate and download compliance reports for audits</p>
        </div>
        <Button onClick={loadReports} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Framework Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(FRAMEWORK_INFO) as ComplianceFramework[]).map((fw) => {
          const info = FRAMEWORK_INFO[fw];
          const Icon = info.icon;
          const count = reports.filter((r) => r.framework === fw).length;

          return (
            <Card key={fw} className={framework === fw ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{info.fullName}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">Reports</p>
                <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>Create a new compliance report for the specified period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Framework Selection */}
            <div className="space-y-2">
              <Label>Framework</Label>
              <Select value={framework} onValueChange={(v) => setFramework(v as ComplianceFramework)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gdpr">GDPR</SelectItem>
                  <SelectItem value="soc2">SOC 2</SelectItem>
                  <SelectItem value="hipaa">HIPAA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period Selection (for SOC 2) */}
            {framework === 'soc2' && (
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Month Selection (for GDPR/HIPAA) */}
            {(framework === 'gdpr' || framework === 'hipaa') && (
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(year, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quarter Selection (for SOC 2 quarterly) */}
            {framework === 'soc2' && period === 'quarterly' && (
              <div className="space-y-2">
                <Label>Quarter</Label>
                <Select value={quarter.toString()} onValueChange={(v) => setQuarter(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Year Selection */}
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>Format</Label>
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
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Save Report
            </Button>
            <Button onClick={handleGenerateAndDownload} disabled={generating} variant="default">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generate & Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>View and download previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports generated yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const info = FRAMEWORK_INFO[report.framework];
                const Icon = info.icon;
                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${info.color}`} />
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{info.name}</Badge>
                          <Badge variant="secondary">{report.period}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(report.id, 'json')}
                      >
                        <FileJson className="h-4 w-4 mr-1" />
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(report.id, 'csv')}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            About Compliance Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 dark:text-blue-100 space-y-2">
          <p>Compliance reports aggregate data across your organization to help with audits and regulatory requirements.</p>
          <p>All generated reports are saved to the database and include full audit trails for evidence collection.</p>
          <p>Reports can be exported in JSON for programmatic analysis or CSV for spreadsheet applications.</p>
        </CardContent>
      </Card>
    </div>
  );
}
