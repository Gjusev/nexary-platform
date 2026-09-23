/**
 * Admin SAML Configuration Component
 *
 * Displays and manages SAML 2.0 configuration for a team.
 * Includes migration status and controls.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save, Trash2, AlertTriangle, Info, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SAMLConfig {
  configured: boolean;
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpSloUrl?: string;
  idpCert?: string;
  spEntityId?: string;
  acsUrl?: string;
  sloUrl?: string;
  metadataUrl?: string;
}

interface MigrationStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'rolled_back';
  mode: 'off' | 'shadow' | 'canary' | 'full';
  canaryPercentage?: number;
  startedAt?: string;
  completedAt?: string;
  samlLoginsCount?: number;
  oidcLoginsCount?: number;
  errorMessage?: string;
}

interface IdPTemplate {
  key: string;
  name: string;
  ssoUrl: string;
  entityId: string;
}

interface AdminSAMLConfigProps {
  teamSlug: string;
  teamName: string;
}

export function AdminSAMLConfig({ teamSlug, teamName }: AdminSAMLConfigProps) {
  const t = useTranslations('admin.saml');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  const [config, setConfig] = useState<SAMLConfig | null>(null);
  const [migration, setMigration] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<IdPTemplate[]>([]);
  const [copied, setCopied] = useState(false);

  // Form state
  const [idpEntityId, setIdpEntityId] = useState('');
  const [idpSsoUrl, setIdpSsoUrl] = useState('');
  const [idpSloUrl, setIdpSloUrl] = useState('');
  const [idpCert, setIdpCert] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'shadow' | 'canary' | 'full'>('shadow');
  const [canaryPercentage, setCanaryPercentage] = useState(10);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchMigration(), fetchTemplates()]);
  }, [teamSlug]);

  async function fetchConfig() {
    try {
      const response = await fetch(`/api/saml/config?teamSlug=${teamSlug}`);
      if (!response.ok) throw new Error('Failed to fetch SAML config');
      const data = await response.json();
      setConfig(data);
      if (data.configured) {
        setIdpEntityId(data.idpEntityId || '');
        setIdpSsoUrl(data.idpSsoUrl || '');
        setIdpSloUrl(data.idpSloUrl || '');
        setIdpCert(data.idpCert || '');
      }
    } catch (error) {
      console.error('Error fetching SAML config:', error);
      toast({
        title: tCommon('error'),
        description: 'Failed to load SAML configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchMigration() {
    try {
      const response = await fetch(`/api/admin/migrations/${teamSlug}`);
      if (!response.ok) return;
      const data = await response.json();
      setMigration(data);
    } catch (error) {
      console.error('Error fetching migration status:', error);
    }
  }

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/saml/config');
      if (!response.ok) return;
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching IdP templates:', error);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const method = config?.configured ? 'PUT' : 'POST';
      const response = await fetch('/api/saml/config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamSlug,
          idpEntityId,
          idpSsoUrl,
          idpSloUrl: idpSloUrl || undefined,
          idpCert,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save configuration');
      }

      toast({
        title: 'Success',
        description: config?.configured
          ? 'SAML configuration updated'
          : 'SAML configuration created',
      });

      await fetchConfig();
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const response = await fetch(`/api/saml/config?teamSlug=${teamSlug}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete configuration');

      toast({
        title: 'Success',
        description: 'SAML configuration deleted',
      });

      setShowDeleteDialog(false);
      router.push('/dashboard/admin/teams');
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: 'Failed to delete configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStartMigration() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/migrations/${teamSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: migrationMode,
          canaryPercentage: migrationMode === 'canary' ? canaryPercentage : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start migration');
      }

      toast({
        title: 'Success',
        description: 'Migration started successfully',
      });

      setShowMigrationDialog(false);
      await fetchMigration();
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : 'Failed to start migration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRollback() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/migrations/${teamSlug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual rollback from admin UI' }),
      });

      if (!response.ok) throw new Error('Failed to rollback migration');

      toast({
        title: 'Success',
        description: 'Migration rolled back successfully',
      });

      setShowRollbackDialog(false);
      await fetchMigration();
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: 'Failed to rollback migration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(templateKey: string) {
    const template = templates.find((t) => t.key === templateKey);
    if (template) {
      setSelectedTemplate(templateKey);
      setIdpEntityId(template.entityId);
      setIdpSsoUrl(template.ssoUrl);
    }
  }

  function copyMetadataUrl() {
    if (config?.metadataUrl) {
      navigator.clipboard.writeText(config.metadataUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">SAML Config</TabsTrigger>
          <TabsTrigger value="migration">
            Migration{' '}
            {migration?.status === 'in_progress' && (
              <Badge variant="secondary" className="ml-2">
                Active
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* SAML Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identity Provider Configuration</CardTitle>
              <CardDescription>
                Configure your SAML 2.0 Identity Provider settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="template">Quick Setup (IdP Template)</Label>
                <Select value={selectedTemplate} onValueChange={applyTemplate}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select your Identity Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IdP Entity ID */}
              <div className="space-y-2">
                <Label htmlFor="idpEntityId">IdP Entity ID</Label>
                <Input
                  id="idpEntityId"
                  value={idpEntityId}
                  onChange={(e) => setIdpEntityId(e.target.value)}
                  placeholder="https://idp.example.com/entityid"
                />
              </div>

              {/* IdP SSO URL */}
              <div className="space-y-2">
                <Label htmlFor="idpSsoUrl">IdP SSO URL</Label>
                <Input
                  id="idpSsoUrl"
                  value={idpSsoUrl}
                  onChange={(e) => setIdpSsoUrl(e.target.value)}
                  placeholder="https://idp.example.com/sso"
                />
              </div>

              {/* IdP SLO URL (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="idpSloUrl">IdP SLO URL (Optional)</Label>
                <Input
                  id="idpSloUrl"
                  value={idpSloUrl}
                  onChange={(e) => setIdpSloUrl(e.target.value)}
                  placeholder="https://idp.example.com/slo"
                />
              </div>

              {/* IdP X.509 Certificate */}
              <div className="space-y-2">
                <Label htmlFor="idpCert">IdP X.509 Certificate</Label>
                <Textarea
                  id="idpCert"
                  value={idpCert}
                  onChange={(e) => setIdpCert(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!config?.configured}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Configuration
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {config?.configured ? 'Update Configuration' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Service Provider Metadata */}
          {config?.configured && (
            <Card>
              <CardHeader>
                <CardTitle>Service Provider Metadata</CardTitle>
                <CardDescription>
                  Share this information with your Identity Provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SP Entity ID</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
                      {config.spEntityId}
                    </code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assertion Consumer Service (ACS) URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
                      {config.acsUrl}
                    </code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Metadata URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
                      {config.metadataUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyMetadataUrl}
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Migration Tab */}
        <TabsContent value="migration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('migration.title')}</CardTitle>
              <CardDescription>
                Migrate from SAML to OIDC for improved security and performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!migration || migration.status === 'not_started' ? (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Migration Overview</AlertTitle>
                    <AlertDescription>
                      The migration process moves your team from SAML authentication
                      to OIDC (OpenID Connect). This provides better security,
                      performance, and modern authentication protocols.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Migration Mode</Label>
                      <Select
                        value={migrationMode}
                        onValueChange={(v: any) => setMigrationMode(v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shadow">
                            Shadow Mode - Test without affecting users
                          </SelectItem>
                          <SelectItem value="canary">
                            Canary Mode - Migrate percentage of users
                          </SelectItem>
                          <SelectItem value="full">
                            Full Migration - Migrate all users
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {migrationMode === 'canary' && (
                      <div className="space-y-2">
                        <Label>Canary Percentage: {canaryPercentage}%</Label>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={canaryPercentage}
                          onChange={(e) => setCanaryPercentage(parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    )}

                    <Button onClick={() => setShowMigrationDialog(true)}>
                      {t('migration.actions.startMigration')}
                    </Button>
                  </div>
                </>
              ) : migration.status === 'in_progress' ? (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Migration in Progress</AlertTitle>
                    <AlertDescription>
                      Your team is currently migrating from SAML to OIDC.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <Badge variant="secondary" className="mt-1">
                          {migration.status}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Mode</Label>
                        <Badge variant="outline" className="mt-1">
                          {migration.mode}
                        </Badge>
                      </div>
                      {migration.canaryPercentage !== undefined && (
                        <div>
                          <Label className="text-muted-foreground">
                            {t('migration.canaryPercent')}
                          </Label>
                          <div className="text-lg font-semibold mt-1">
                            {migration.canaryPercentage}%
                          </div>
                        </div>
                      )}
                    </div>

                    {migration.startedAt && (
                      <div>
                        <Label className="text-muted-foreground">
                          {t('migration.startedAt')}
                        </Label>
                        <div className="text-sm mt-1">
                          {new Date(migration.startedAt).toLocaleString()}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => setShowRollbackDialog(true)}
                    >
                      {t('migration.actions.rollback')}
                    </Button>
                  </div>
                </>
              ) : migration.status === 'completed' ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Migration Completed</AlertTitle>
                  <AlertDescription>
                    Your team has successfully migrated to OIDC. SAML
                    authentication has been disabled.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle>Migration Rolled Back</AlertTitle>
                  <AlertDescription>
                    The migration was rolled back. Your team is using SAML
                    authentication.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SAML Configuration?</DialogTitle>
            <DialogDescription>
              This will permanently remove the SAML configuration for team{' '}
              <strong>{teamName}</strong>. Users will no longer be able to sign
              in via SAML.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration Start Dialog */}
      <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Migration to OIDC?</DialogTitle>
            <DialogDescription>
              This will begin migrating team <strong>{teamName}</strong> from SAML
              to OIDC authentication.
              {migrationMode === 'shadow' &&
                ' Shadow mode tests OIDC without affecting users.'}
              {migrationMode === 'canary' &&
                ` Canary mode will migrate ${canaryPercentage}% of users.`}
              {migrationMode === 'full' &&
                ' Full mode will migrate all users to OIDC.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMigrationDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleStartMigration} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Start Migration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback Migration?</DialogTitle>
            <DialogDescription>
              This will rollback the migration and return to using SAML
              authentication for team <strong>{teamName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRollbackDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRollback} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
