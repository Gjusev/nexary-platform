'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Server,
  FileCheck,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ControlReport {
  control: string;
  status: 'pass' | 'fail' | 'warning';
  findings: string[];
  verifiedAt: string;
}

interface SOC2Summary {
  overallStatus: 'compliant' | 'non_compliant' | 'partial';
  controlsValidated: number;
  controlsPassed: number;
  controlsFailed: number;
  controlsWarning: number;
  lastAssessment: string;
}

export default function ComplianceDashboardPage() {
  const t = useTranslations('compliance.soc2');
  const { toast } = useToast();
  const user = useUser();

  const [summary, setSummary] = useState<SOC2Summary | null>(null);
  const [controls, setControls] = useState<ControlReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/compliance/soc2');

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setControls(data.controls || []);
      } else {
        throw new Error('Failed to load compliance data');
      }
    } catch (error) {
      toast({
        title: 'Error loading compliance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadComplianceData();
    setRefreshing(false);
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: 'compliant' | 'non_compliant' | 'partial' | 'pass' | 'fail' | 'warning') => {
    const config = {
      compliant: { color: 'bg-green-100 text-green-800', label: 'Compliant' },
      partial: { color: 'bg-yellow-100 text-yellow-800', label: 'Partial' },
      non_compliant: { color: 'bg-red-100 text-red-800', label: 'Non-Compliant' },
      pass: { color: 'bg-green-100 text-green-800', label: 'Pass' },
      fail: { color: 'bg-red-100 text-red-800', label: 'Fail' },
      warning: { color: 'bg-yellow-100 text-yellow-800', label: 'Warning' },
    }[status];

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getControlIcon = (control: string) => {
    const icons: Record<string, React.ReactNode> = {
      ACCESS_CONTROL: <UserCheck className="w-4 h-4" />,
      NETWORK_SECURITY: <Shield className="w-4 h-4" />,
      AVAILABILITY: <Server className="w-4 h-4" />,
      PROCESSING_INTEGRITY: <FileCheck className="w-4 h-4" />,
      CONFIDENTIALITY: <Lock className="w-4 h-4" />,
      PRIVACY: <UserCheck className="w-4 h-4" />,
    };

    return icons[control] || <Shield className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="container max-w-7xl py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You don&apos;t have permission to view compliance data.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">SOC 2 Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and validate SOC 2 Type II compliance controls
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(summary.overallStatus === 'compliant' ? 'pass' : summary.overallStatus === 'partial' ? 'warning' : 'fail')}
              {getStatusBadge(summary.overallStatus)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Controls Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.controlsPassed}</div>
            <div className="text-xs text-muted-foreground">of {summary.controlsValidated} validated</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.controlsWarning}</div>
            <div className="text-xs text-muted-foreground">requiring attention</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.controlsFailed}</div>
            <div className="text-xs text-muted-foreground">critical issues</div>
          </CardContent>
        </Card>
      </div>

      {/* Last Assessment */}
      <Alert className="mb-8">
        <Clock className="h-4 w-4" />
        <AlertTitle>Last Assessment</AlertTitle>
        <AlertDescription>
          {new Date(summary.lastAssessment).toLocaleString()}
        </AlertDescription>
      </Alert>

      {/* Controls Detail */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Controls</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="integrity">Processing Integrity</TabsTrigger>
          <TabsTrigger value="confidentiality">Confidentiality</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {controls.map((control) => (
            <ControlCard key={control.control} control={control} getIcon={getControlIcon} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
          ))}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          {controls
            .filter((c) => ['ACCESS_CONTROL', 'NETWORK_SECURITY'].includes(c.control))
            .map((control) => (
              <ControlCard key={control.control} control={control} getIcon={getControlIcon} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
            ))}
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">
          {controls
            .filter((c) => c.control === 'AVAILABILITY')
            .map((control) => (
              <ControlCard key={control.control} control={control} getIcon={getControlIcon} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
            ))}
        </TabsContent>

        <TabsContent value="integrity" className="space-y-4">
          {controls
            .filter((c) => c.control === 'PROCESSING_INTEGRITY')
            .map((control) => (
              <ControlCard key={control.control} control={control} getIcon={getControlIcon} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
            ))}
        </TabsContent>

        <TabsContent value="confidentiality" className="space-y-4">
          {controls
            .filter((c) => c.control === 'CONFIDENTIALITY')
            .map((control) => (
              <ControlCard key={control.control} control={control} getIcon={getControlIcon} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
            ))}
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          {controls
            .filter((c) => c.control === 'PRIVACY')
            .map((control) => (
              <ControlCard key={control.control} control={control} getIcon={getControlIcon} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ControlCardProps {
  control: ControlReport;
  getIcon: (control: string) => React.ReactNode;
  getStatusBadge: (status: 'pass' | 'fail' | 'warning') => React.ReactNode;
  getStatusIcon: (status: 'pass' | 'fail' | 'warning') => React.ReactNode;
}

function ControlCard({ control, getIcon, getStatusBadge, getStatusIcon }: ControlCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getIcon(control.control)}
            <CardTitle className="text-lg">{control.control.replace(/_/g, ' ')}</CardTitle>
            {getStatusBadge(control.status)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {new Date(control.verifiedAt).toLocaleDateString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show Less' : 'Show More'}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-2">
            {control.findings.map((finding, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                {getStatusIcon(control.status)}
                <span className={finding.startsWith('✓') ? 'text-green-700' : finding.startsWith('✗') ? 'text-red-700' : 'text-yellow-700'}>
                  {finding}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
