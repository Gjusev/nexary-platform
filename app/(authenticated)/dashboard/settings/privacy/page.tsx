'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Trash2,
  Check,
  X,
  AlertTriangle,
  FileText,
  Shield,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConsentRecord {
  consentType: string;
  granted: boolean;
  grantedAt: string;
  withdrawnAt: string | null;
  version: string;
}

interface GDPRRequest {
  id: string;
  requestType: 'access' | 'erasure' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
}

interface UserData {
  userId: string;
  email: string | null;
  profile: {
    displayName: string | null;
    createdAt: string;
    lastLogin: string | null;
  };
  teamMemberships: Array<{
    teamSlug: string;
    teamName: string | null;
    role: string | null;
    status: string;
    joinedAt: string;
  }>;
  chatConversations: Array<{
    conversationId: string;
    teamSlug: string | null;
    messageCount: number;
    firstMessageAt: string | null;
    lastMessageAt: string | null;
  }>;
  uploadedDocuments: Array<{
    documentId: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    ragPackageId: string | null;
  }>;
  apiKeys: Array<{
    keyId: string;
    name: string;
    prefix: string;
    scopes: string[];
    createdAt: string;
    lastUsed: string | null;
  }>;
}

export default function PrivacySettingsPage() {
  const t = useTranslations('gdpr');
  const { toast } = useToast();
  const user = useUser();

  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Data export
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exporting, setExporting] = useState(false);

  // Data erasure
  const [canDelete, setCanDelete] = useState<boolean | null>(null);
  const [deleteReasons, setDeleteReasons] = useState<string[]>([]);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load data
  useEffect(() => {
    loadConsents();
    loadRequests();
  }, []);

  const loadConsents = async () => {
    try {
      const response = await fetch('/api/gdpr/consent');
      if (response.ok) {
        const data = await response.json();
        setConsents(data.consents || []);
      }
    } catch (error) {
      console.error('Failed to load consents:', error);
    }
  };

  const loadRequests = async () => {
    try {
      const response = await fetch('/api/gdpr/requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
    }
  };

  useEffect(() => {
    if (!loading) return;
    Promise.all([loadConsents(), loadRequests()]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Get consent status for a type
  const getConsentStatus = (consentType: string) => {
    const consent = consents.find((c) => c.consentType === consentType && !c.withdrawnAt);
    return consent?.granted || false;
  };

  // Toggle consent
  const toggleConsent = async (consentType: string, granted: boolean) => {
    try {
      const response = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentType, granted }),
      });

      if (response.ok) {
        await loadConsents();
        toast({
          title: granted ? t('consents.grant') : t('consents.revoke'),
          description: granted
            ? t('messages.consentGranted')
            : t('messages.consentRevoked'),
        });
      } else {
        throw new Error('Failed to update consent');
      }
    } catch (error) {
      toast({
        title: t('errors.updateConsentFailed'),
        description: error instanceof Error ? error.message : t('errors.unknown'),
        variant: 'destructive',
      });
    }
  };

  // Request data access
  const requestDataAccess = async () => {
    try {
      const response = await fetch('/api/gdpr/data-access');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        toast({
          title: t('dataAccess.title'),
          description: t('messages.dataLoaded'),
        });
      }
    } catch (error) {
      toast({
        title: t('errors.fetchFailed'),
        variant: 'destructive',
      });
    }
  };

  // Export data
  const exportData = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/gdpr/data-export?format=${exportFormat}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `gdpr-export-${user?.id || 'user'}-${timestamp}.${exportFormat}`;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: t('dataExport.title'),
          description: t('messages.dataExported'),
        });
      }
    } catch (error) {
      toast({
        title: t('errors.fetchFailed'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  // Check if can delete data
  const checkCanDelete = async () => {
    setCheckingDelete(true);
    try {
      const response = await fetch('/api/gdpr/data-delete');
      if (response.ok) {
        const data = await response.json();
        setCanDelete(data.canErase);
        setDeleteReasons(data.reasons || []);
      }
    } catch (error) {
      toast({
        title: t('errors.fetchFailed'),
        variant: 'destructive',
      });
    } finally {
      setCheckingDelete(false);
    }
  };

  // Request data deletion
  const requestDeletion = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/gdpr/data-delete', {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: t('dataErasure.title'),
          description: data.message,
        });
        setShowDeleteConfirm(false);
      } else {
        const data = await response.json();
        toast({
          title: t('errors.deleteFailed'),
          description: data.error || t('errors.processingFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('errors.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Create GDPR request
  const createRequest = async (requestType: 'access' | 'erasure' | 'portability') => {
    try {
      const response = await fetch('/api/gdpr/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType }),
      });

      if (response.ok) {
        await loadRequests();
        toast({
          title: t('requests.createButton'),
          description: t('messages.requestCreated'),
        });
      }
    } catch (error) {
      toast({
        title: t('errors.requestFailed'),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <RefreshCw className="w-3 h-3" /> },
      processing: { color: 'bg-blue-100 text-blue-800', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
      completed: { color: 'bg-green-100 text-green-800', icon: <Check className="w-3 h-3" /> },
      rejected: { color: 'bg-red-100 text-red-800', icon: <X className="w-3 h-3" /> },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={config.color}>
        <span className="flex items-center gap-1">
          {config.icon}
          {t(`requests.status.${status}`)}
        </span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('messages.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Tabs defaultValue="rights" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rights">{t('tabs.rights')}</TabsTrigger>
          <TabsTrigger value="data">{t('tabs.data')}</TabsTrigger>
          <TabsTrigger value="consents">{t('tabs.consents')}</TabsTrigger>
          <TabsTrigger value="requests">{t('tabs.requests')}</TabsTrigger>
        </TabsList>

        {/* GDPR Rights Tab */}
        <TabsContent value="rights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('rights.title')}
              </CardTitle>
              <CardDescription>{t('rights.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="border rounded-lg p-6">
                  <h3 className="font-semibold mb-3">{t('rights.access.title')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('rights.access.description')}</p>
                </div>
                <div className="border rounded-lg p-6">
                  <h3 className="font-semibold mb-3">{t('rights.erasure.title')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('rights.erasure.description')}</p>
                </div>
                <div className="border rounded-lg p-6">
                  <h3 className="font-semibold mb-3">{t('rights.portability.title')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('rights.portability.description')}</p>
                </div>
                <div className="border rounded-lg p-6">
                  <h3 className="font-semibold mb-3">{t('rights.rectification.title')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('rights.rectification.description')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Data Tab */}
        <TabsContent value="data" className="space-y-6">
          {/* Data Access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('dataAccess.title')}
              </CardTitle>
              <CardDescription>{t('dataAccess.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!userData ? (
                <Button onClick={requestDataAccess} className="min-w-[200px]">
                  <UserCheck className="w-4 h-4 mr-2" />
                  {t('dataAccess.requestButton')}
                </Button>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                      <h4 className="font-semibold mb-2">{t('dataAccess.sections.profile')}</h4>
                      <p className="text-2xl font-bold">1</p>
                    </div>
                    <div className="border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                      <h4 className="font-semibold mb-2">{t('dataAccess.sections.teams')}</h4>
                      <p className="text-2xl font-bold">{userData.teamMemberships.length}</p>
                    </div>
                    <div className="border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                      <h4 className="font-semibold mb-2">{t('dataAccess.sections.conversations')}</h4>
                      <p className="text-2xl font-bold">{userData.chatConversations.length}</p>
                    </div>
                    <div className="border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                      <h4 className="font-semibold mb-2">{t('dataAccess.sections.documents')}</h4>
                      <p className="text-2xl font-bold">{userData.uploadedDocuments.length}</p>
                    </div>
                    <div className="border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                      <h4 className="font-semibold mb-2">{t('dataAccess.sections.apiKeys')}</h4>
                      <p className="text-2xl font-bold">{userData.apiKeys.length}</p>
                    </div>
                    <div className="border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                      <h4 className="font-semibold mb-2">{t('dataAccess.sections.consents')}</h4>
                      <p className="text-2xl font-bold">{consents.length}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                {t('dataExport.title')}
              </CardTitle>
              <CardDescription>{t('dataExport.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>{t('dataExport.formatLabel')}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                  >
                    <option value="json">{t('dataExport.formats.json')}</option>
                    <option value="csv">{t('dataExport.formats.csv')}</option>
                  </select>
                </div>
                <Button onClick={exportData} disabled={exporting}>
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? t('dataExport.exporting') : t('dataExport.exportButton')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t('dataExport.info')}</p>
            </CardContent>
          </Card>

          {/* Data Erasure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                {t('dataErasure.title')}
              </CardTitle>
              <CardDescription>{t('dataErasure.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('dataErasure.warning')}</AlertTitle>
              </Alert>

              {canDelete !== null && (
                <Alert variant={canDelete ? 'default' : 'destructive'}>
                  {canDelete ? (
                    <>
                      <Check className="h-4 w-4" />
                      <AlertTitle>{t('dataErasure.canDelete')}</AlertTitle>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      <AlertTitle>{t('dataErasure.cannotDelete')}</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside mt-2">
                          {deleteReasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}

              <div className="flex gap-2">
                {canDelete === null ? (
                  <Button onClick={checkCanDelete} disabled={checkingDelete} variant="outline">
                    <RefreshCw className={`w-4 h-4 mr-2 ${checkingDelete ? 'animate-spin' : ''}`} />
                    {checkingDelete ? t('dataErasure.checking') : t('dataErasure.checkButton')}
                  </Button>
                ) : canDelete ? (
                  <Button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? t('dataErasure.deleting') : t('dataErasure.deleteButton')}
                  </Button>
                ) : (
                  <Button onClick={checkCanDelete} disabled={checkingDelete} variant="outline">
                    <RefreshCw className={`w-4 h-4 mr-2 ${checkingDelete ? 'animate-spin' : ''}`} />
                    {t('dataErasure.checkButton')}
                  </Button>
                )}
              </div>

              {showDeleteConfirm && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('dataErasure.confirmTitle')}</AlertTitle>
                  <AlertDescription className="space-y-4">
                    <p>{t('dataErasure.confirmDescription')}</p>
                    <div className="flex gap-2">
                      <Button onClick={requestDeletion} disabled={deleting} variant="destructive">
                        {t('dataErasure.confirmButton')}
                      </Button>
                      <Button onClick={() => setShowDeleteConfirm(false)} variant="outline">
                        {t('dataErasure.cancelButton')}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consents Tab */}
        <TabsContent value="consents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('consents.title')}</CardTitle>
              <CardDescription>{t('consents.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(['marketing', 'analytics', 'cookies', 'thirdParty', 'email'] as const).map((type) => {
                const isRequired = type === 'cookies';
                const consentKey = `consents.types.${type}` as const;

                const consentTypeMap: Record<string, string> = {
                  marketing: 'marketing',
                  analytics: 'analytics',
                  cookies: 'cookies',
                  thirdParty: 'third_party_sharing',
                  email: 'email_communications',
                };
                const consentTypeKey = consentTypeMap[type] as 'marketing' | 'analytics' | 'cookies' | 'third_party_sharing' | 'email_communications';

                return (
                  <div key={type} className="flex items-center justify-between py-4 border-b last:border-0">
                    <div className="flex-1 pr-6">
                      <h3 className="font-semibold mb-1">{t(`${consentKey}.title`)}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(`${consentKey}.description`)}</p>
                      {isRequired && (
                        <Badge variant="secondary" className="mt-2">{t('messages.required')}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Switch
                        checked={getConsentStatus(consentTypeKey)}
                        onCheckedChange={(checked) => toggleConsent(consentTypeKey, checked)}
                        disabled={isRequired}
                      />
                      <span className="text-sm text-muted-foreground w-24 text-right">
                        {getConsentStatus(consentTypeKey) ? t('consents.granted') : t('consents.revoked')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('requests.title')}</CardTitle>
              <CardDescription>{t('requests.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => createRequest('access')} variant="outline" className="min-w-[140px]">
                  {t('requests.types.access')}
                </Button>
                <Button onClick={() => createRequest('portability')} variant="outline" className="min-w-[140px]">
                  {t('requests.types.portability')}
                </Button>
                <Button onClick={() => createRequest('erasure')} variant="outline" className="min-w-[140px]">
                  {t('requests.types.erasure')}
                </Button>
              </div>

              {requests.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">{t('messages.noRequests')}</p>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{t(`requests.types.${request.requestType}`)}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {request.rejectionReason && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{request.rejectionReason}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
