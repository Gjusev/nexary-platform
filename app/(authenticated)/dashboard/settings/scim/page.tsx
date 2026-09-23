'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle, XCircle, Key, Copy, Plus, Trash2, ExternalLink, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SCIMToken = {
  id: string;
  name: string;
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
};

type NewTokenResponse = {
  id: string;
  name: string;
  token: string;
  createdAt: string;
};

type SCIMConfig = {
  enabled: boolean;
  tokens: SCIMToken[];
};

export default function SCIMSettingsPage() {
  const t = useTranslations('scim');
  const { teamSlug, isOwner, isGlobalAdmin, isLoading: authLoading } = useTeam();

  const [config, setConfig] = useState<SCIMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newToken, setNewToken] = useState<NewTokenResponse | null>(null);
  const [selectedIdpGuide, setSelectedIdpGuide] = useState<string | null>(null);

  // Form state for creating token
  const [tokenName, setTokenName] = useState('');

  useEffect(() => {
    if (teamSlug) {
      fetchConfig();
    }
  }, [teamSlug]);

  async function fetchConfig() {
    if (!teamSlug) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/scim/config?teamSlug=${encodeURIComponent(teamSlug)}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || t('errors.unauthorized'));
      }
    } catch (err) {
      console.error('Error fetching SCIM config:', err);
      setError(t('errors.unauthorized'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!teamSlug || !tokenName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/scim/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamSlug,
          name: tokenName.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewToken(data);
        setTokenName('');
        await fetchConfig();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || t('errors.createFailed'));
      }
    } catch (err) {
      console.error('Error creating token:', err);
      setError(t('errors.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeToken(tokenId: string) {
    if (!teamSlug) return;

    try {
      const res = fetch(`/api/scim/config?teamSlug=${encodeURIComponent(teamSlug)}&tokenId=${tokenId}`, {
        method: 'DELETE',
      });

      if ((await res).ok) {
        await fetchConfig();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await (await res).json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || t('errors.revokeFailed'));
      }
    } catch (err) {
      console.error('Error revoking token:', err);
      setError(t('errors.revokeFailed'));
    }
  }

  async function handleCopyToken() {
    if (!newToken?.token) return;

    try {
      await navigator.clipboard.writeText(newToken.token);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  }

  function getSCIMUrl() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/api/scim/v2`;
  }

  async function handleCopySCIMUrl() {
    try {
      await navigator.clipboard.writeText(getSCIMUrl());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return t('tokens.never');
    return new Date(dateStr).toLocaleDateString();
  }

  function formatDateRelative(dateStr: string | null): string {
    if (!dateStr) return t('tokens.never');
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('tokens.lastUsed');
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    return formatDate(dateStr);
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner && !isGlobalAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('errors.unauthorized')}</p>
      </div>
    );
  }

  const scimUrl = getSCIMUrl();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>

        {config?.enabled && (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('enabled')}
          </Badge>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="bg-green-500/10 text-green-600 px-4 py-3 rounded-md flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {t('tokens.tokenCreated')}
        </div>
      )}

      <Tabs defaultValue="tokens" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tokens">{t('tokens.title')}</TabsTrigger>
          <TabsTrigger value="setup">{t('setup.title')}</TabsTrigger>
          <TabsTrigger value="guides">{t('idpGuides.title')}</TabsTrigger>
        </TabsList>

        {/* Tokens Tab */}
        <TabsContent value="tokens" className="space-y-6">
          {/* Create Token Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t('tokens.createButton')}
              </CardTitle>
              <CardDescription>{t('tokens.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <Label htmlFor="tokenName">{t('tokens.name')}</Label>
                  <Input
                    id="tokenName"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder={t('tokens.namePlaceholder')}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('tokens.nameDescription')}
                  </p>
                </div>

                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('tokens.createButton')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tokens List */}
          {config?.tokens && config.tokens.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Active Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {config.tokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{token.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>
                            {t('tokens.createdAt')}: {formatDate(token.createdAt)}
                          </div>
                          <div>
                            {t('tokens.lastUsed')}: {formatDateRelative(token.lastUsed)}
                          </div>
                        </div>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('tokens.revokeConfirm')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. The Identity Provider using this token
                              will no longer be able to access the SCIM API.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevokeToken(token.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Revoke Token
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{t('tokens.noTokens')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('setup.title')}</CardTitle>
              <CardDescription>{t('setup.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-2">
                <h3 className="font-semibold">{t('setup.step1.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('setup.step1.description')}</p>
              </div>

              {/* Step 2 */}
              <div className="space-y-4">
                <h3 className="font-semibold">{t('setup.step2.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('setup.step2.description')}</p>

                {/* SCIM URL */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('setup.step2.scimUrl')}
                  </Label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-2 text-sm bg-muted rounded font-mono">
                      {scimUrl}
                    </code>
                    <Button onClick={handleCopySCIMUrl} variant="outline" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Bearer Token */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('setup.step2.bearerToken')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Copy the bearer token from the token you created in the Tokens tab.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <h3 className="font-semibold">{t('setup.step3.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('setup.step3.description')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IdP Guides Tab */}
        <TabsContent value="guides" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('idpGuides.title')}</CardTitle>
              <CardDescription>{t('idpGuides.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Okta */}
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => setSelectedIdpGuide('okta')}
                >
                  <ExternalLink className="h-5 w-5" />
                  <span className="font-medium">{t('idpGuides.okta.title')}</span>
                </Button>

                {/* Azure AD */}
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => setSelectedIdpGuide('azure')}
                >
                  <ExternalLink className="h-5 w-5" />
                  <span className="font-medium">{t('idpGuides.azure.title')}</span>
                </Button>

                {/* Google Workspace */}
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => setSelectedIdpGuide('google')}
                >
                  <ExternalLink className="h-5 w-5" />
                  <span className="font-medium">{t('idpGuides.google.title')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Token Dialog */}
      <Dialog open={!!newToken} onOpenChange={(open) => !open && setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tokens.tokenCreated')}</DialogTitle>
            <DialogDescription>{t('tokens.tokenRevokeWarning')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Token Name</Label>
              <p className="font-medium">{newToken?.name}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Bearer Token</Label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 p-2 text-xs bg-muted rounded font-mono break-all">
                  {newToken?.token}
                </code>
                <Button onClick={handleCopyToken} variant="outline" size="sm">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IdP Guide Dialog */}
      <Dialog open={!!selectedIdpGuide} onOpenChange={(open) => !open && setSelectedIdpGuide(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {selectedIdpGuide && t(`idpGuides.${selectedIdpGuide}.title`)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedIdpGuide && (
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {(t.raw(`idpGuides.${selectedIdpGuide}.steps`) as string[]).map((step, index) => (
                  <li key={index} className="pl-2">
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setSelectedIdpGuide(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
