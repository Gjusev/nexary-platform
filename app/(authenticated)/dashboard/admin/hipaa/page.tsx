'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@stackframe/stack';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, FileText, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface PHIAccessLog {
  id: string;
  userId: string;
  phiResourceId: string;
  resourceType: string;
  accessType: string;
  purpose: string;
  purposeDetails?: string;
  authorizedBy?: string;
  createdAt: string;
}

interface BAAAgreement {
  id: string;
  teamSlug: string;
  vendorName: string;
  vendorContactEmail: string;
  effectiveDate: string;
  expirationDate?: string;
  status: 'active' | 'expired' | 'terminated';
  terms: string;
}

interface RiskAssessment {
  id: string;
  teamSlug?: string;
  title: string;
  threatType: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationMeasures: string[];
  implementationStatus: 'not_started' | 'in_progress' | 'completed';
  lastReviewedAt: string;
  nextReviewDate: string;
}

interface HIPAASummary {
  technicalSafeguards: {
    accessControl: { compliant: boolean; findings: string[] };
    auditControls: { compliant: boolean; findings: string[] };
    integrity: { compliant: boolean; findings: string[] };
    transmissionSecurity: { compliant: boolean; findings: string[] };
  };
  baaAgreements: number;
  activeBAAs: number;
  riskAssessments: number;
  criticalRisks: number;
  overdueRiskReviews: number;
}

export default function HIPAACompliancePage() {
  const t = useTranslations('admin.hipaa');
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<HIPAASummary | null>(null);
  const [accessLogs, setAccessLogs] = useState<PHIAccessLog[]>([]);
  const [baaAgreements, setBaaAgreements] = useState<BAAAgreement[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);

  useEffect(() => {
    loadHIPAAData();
  }, [user]);

  const loadHIPAAData = async () => {
    try {
      setLoading(true);

      // Load summary
      const summaryRes = await fetch('/api/admin/compliance/hipaa?summary=true');
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.summary);
      }

      // Load access logs
      const logsRes = await fetch('/api/admin/compliance/hipaa?phi-logs=true&limit=20');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setAccessLogs(data.logs || []);
      }

      // Load risk assessments
      const risksRes = await fetch('/api/admin/compliance/hipaa?risks=true');
      if (risksRes.ok) {
        const data = await risksRes.json();
        setRiskAssessments(data.assessments || []);
      }

      // Load BAA agreements (will need teamSlug filter in real implementation)
      const baaRes = await fetch('/api/admin/compliance/hipaa?baa=demo-team');
      if (baaRes.ok) {
        const data = await baaRes.json();
        setBaaAgreements(data.agreements || []);
      }
    } catch (error) {
      console.error('Failed to load HIPAA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRiskLevelBadgeVariant = (level: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (level) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getImplementationStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in_progress':
        return 'text-yellow-600';
      case 'not_started':
        return 'text-gray-600';
    }
  };

  const getBAAStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'expired':
        return 'secondary';
      case 'terminated':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button onClick={loadHIPAAData} variant="outline" size="sm">
          {t('refresh')}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.baas.title')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeBAAs}</div>
              <p className="text-xs text-muted-foreground">
                {t('summary.baas.total', { total: summary.baaAgreements })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.risks.title')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.criticalRisks}</div>
              <p className="text-xs text-muted-foreground">
                {t('summary.risks.critical', { total: summary.riskAssessments })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.overdue.title')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.overdueRiskReviews}</div>
              <p className="text-xs text-muted-foreground">{t('summary.overdue.description')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('summary.compliance.title')}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(summary.technicalSafeguards).filter((s) => s.compliant).length}/4
              </div>
              <p className="text-xs text-muted-foreground">{t('summary.compliance.description')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="safeguards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="safeguards">{t('tabs.safeguards')}</TabsTrigger>
          <TabsTrigger value="phi-logs">{t('tabs.phiLogs')}</TabsTrigger>
          <TabsTrigger value="baa">{t('tabs.baa')}</TabsTrigger>
          <TabsTrigger value="risks">{t('tabs.risks')}</TabsTrigger>
        </TabsList>

        {/* Technical Safeguards */}
        <TabsContent value="safeguards" className="space-y-4">
          {summary && (
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {t('safeguards.title')}
                  </CardTitle>
                  <CardDescription>{t('safeguards.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Access Control */}
                  <div className="flex items-start gap-3">
                    {summary.technicalSafeguards.accessControl.compliant ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{t('safeguards.accessControl.title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('safeguards.accessControl.description')}
                      </p>
                      <ul className="text-sm space-y-1">
                        {summary.technicalSafeguards.accessControl.findings.map((finding, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            • {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Audit Controls */}
                  <div className="flex items-start gap-3">
                    {summary.technicalSafeguards.auditControls.compliant ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{t('safeguards.auditControls.title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('safeguards.auditControls.description')}
                      </p>
                      <ul className="text-sm space-y-1">
                        {summary.technicalSafeguards.auditControls.findings.map((finding, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            • {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Integrity */}
                  <div className="flex items-start gap-3">
                    {summary.technicalSafeguards.integrity.compliant ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{t('safeguards.integrity.title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('safeguards.integrity.description')}
                      </p>
                      <ul className="text-sm space-y-1">
                        {summary.technicalSafeguards.integrity.findings.map((finding, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            • {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Transmission Security */}
                  <div className="flex items-start gap-3">
                    {summary.technicalSafeguards.transmissionSecurity.compliant ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{t('safeguards.transmission.title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('safeguards.transmission.description')}
                      </p>
                      <ul className="text-sm space-y-1">
                        {summary.technicalSafeguards.transmissionSecurity.findings.map((finding, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            • {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* PHI Access Logs */}
        <TabsContent value="phi-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('phiLogs.title')}</CardTitle>
              <CardDescription>{t('phiLogs.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {accessLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('phiLogs.noLogs')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accessLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.accessType}</Badge>
                          <Badge variant="outline">{log.resourceType}</Badge>
                          <span className="text-sm font-medium">{log.purpose}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {t('phiLogs.resource')}: {log.phiResourceId}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BAA Agreements */}
        <TabsContent value="baa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('baa.title')}</CardTitle>
              <CardDescription>{t('baa.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {baaAgreements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('baa.noAgreements')}</p>
                  <Button className="mt-4" size="sm">
                    {t('baa.createFirst')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {baaAgreements.map((agreement) => (
                    <div
                      key={agreement.id}
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{agreement.vendorName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {agreement.vendorContactEmail}
                          </p>
                        </div>
                        <Badge variant={getBAAStatusBadgeVariant(agreement.status)}>
                          {agreement.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>
                          {t('baa.effectiveDate')}: {formatDate(agreement.effectiveDate)}
                        </div>
                        {agreement.expirationDate && (
                          <div>
                            {t('baa.expirationDate')}: {formatDate(agreement.expirationDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Assessments */}
        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('risks.title')}</CardTitle>
              <CardDescription>{t('risks.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {riskAssessments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('risks.noAssessments')}</p>
                  <Button className="mt-4" size="sm">
                    {t('risks.createFirst')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {riskAssessments.map((risk) => (
                    <div
                      key={risk.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{risk.title}</h4>
                            <Badge variant={getRiskLevelBadgeVariant(risk.riskLevel)}>
                              {risk.riskLevel.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t('risks.threatType')}: {risk.threatType.replace(/_/g, ' ')}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <span>{t('risks.likelihood')}: </span>
                            <Badge variant="outline" className="text-xs">
                              {risk.likelihood}
                            </Badge>
                            <span>{t('risks.impact')}: </span>
                            <Badge variant="outline" className="text-xs">
                              {risk.impact}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className={`font-medium ${getImplementationStatusColor(risk.implementationStatus)}`}>
                            {risk.implementationStatus.replace(/_/g, ' ')}
                          </div>
                          {isOverdue(risk.nextReviewDate) && (
                            <Badge variant="destructive" className="mt-1">
                              {t('risks.overdue')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {risk.mitigationMeasures.length > 0 && (
                        <div className="border-t pt-2">
                          <p className="text-sm font-medium mb-1">{t('risks.mitigation')}:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {risk.mitigationMeasures.map((measure, idx) => (
                              <li key={idx}>• {measure}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Shield className="h-5 w-5" />
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
