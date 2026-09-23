/**
 * Admin SCIM Configuration Component
 *
 * Displays and manages SCIM 2.0 tokens and sync logs for a team.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Key,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SCIMToken {
  id: string;
  name: string;
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

interface SCIMSyncLog {
  id: string;
  teamSlug: string;
  operation: 'create' | 'update' | 'delete' | 'patch';
  resourceType: 'User' | 'Group';
  resourceId?: string;
  scimId?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: Date;
}

interface AdminSCIMConfigProps {
  teamSlug: string;
  teamName: string;
}

export function AdminSCIMConfig({ teamSlug, teamName }: AdminSCIMConfigProps) {
  const t = useTranslations('admin.scim');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<SCIMToken[]>([]);
  const [logs, setLogs] = useState<SCIMSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<SCIMToken | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // New token display
  const [createdToken, setCreatedToken] = useState<{ token: string; id: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchTokens(), fetchLogs()]);
  }, [teamSlug]);

  async function fetchTokens() {
    try {
      const response = await fetch(`/api/scim/config?teamSlug=${teamSlug}`);
      if (!response.ok) throw new Error('Failed to fetch SCIM tokens');
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error('Error fetching SCIM tokens:', error);
      toast({
        title: tCommon('error'),
        description: 'Failed to load SCIM tokens',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const response = await fetch(`/api/scim/logs?teamSlug=${teamSlug}&limit=50`);
      if (!response.ok) return;
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching SCIM logs:', error);
    }
  }

  async function handleCreateToken() {
    if (!newTokenName.trim()) {
      toast({
        title: tCommon('error'),
        description: 'Token name is required',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/scim/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamSlug,
          name: newTokenName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create token');
      }

      const data = await response.json();
      setCreatedToken({ token: data.token, id: data.id });
      setShowCreateDialog(false);
      setNewTokenName('');

      toast({
        title: 'Token Created',
        description: 'Save your token now. It will not be shown again.',
      });

      await fetchTokens();
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : 'Failed to create token',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!tokenToRevoke) return;

    setRevoking(true);
    try {
      const response = await fetch(
        `/api/scim/config?teamSlug=${teamSlug}&tokenId=${tokenToRevoke.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to revoke token');

      toast({
        title: 'Success',
        description: 'SCIM token revoked',
      });

      setShowRevokeDialog(false);
      setTokenToRevoke(null);
      await fetchTokens();
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: 'Failed to revoke token',
        variant: 'destructive',
      });
    } finally {
      setRevoking(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchTokens(), fetchLogs()]);
    setRefreshing(false);
  }

  function copyToken(token: string, tokenId: string) {
    navigator.clipboard.writeText(token);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  function getStatusBadge(status: SCIMSyncLog['status']) {
    const variants = {
      success: 'default',
      failed: 'destructive',
      pending: 'secondary',
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status}
      </Badge>
    );
  }

  function getOperationBadge(operation: SCIMSyncLog['operation']) {
    const variants: Record<typeof operation, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      create: 'default',
      update: 'secondary',
      delete: 'destructive',
      patch: 'outline',
    };

    return (
      <Badge variant={variants[operation]} className="capitalize">
        {operation}
      </Badge>
    );
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
      {/* New Token Display Alert */}
      {createdToken && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <Key className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Save Your SCIM Token</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              This token will only be shown once. Copy it now and store it securely.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-black px-3 py-2 rounded text-sm break-all">
                {createdToken.token}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToken(createdToken!.token, createdToken!.id)}
              >
                {copiedToken === createdToken.id ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreatedToken(null)}
            >
              {`I've saved the token`}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="tokens" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="tokens">
              <Key className="h-4 w-4 mr-2" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="h-4 w-4 mr-2" />
              Sync Logs
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Tokens Tab */}
        <TabsContent value="tokens" className="space-y-6">
          {tokens.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No SCIM Tokens</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create a SCIM bearer token to enable automatic user and group
                  provisioning from your Identity Provider.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('tokens.create')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{t('tokens.title')}</CardTitle>
                    <CardDescription>
                      Manage SCIM 2.0 bearer tokens for automatic provisioning
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('tokens.create')}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('tokens.name')}</TableHead>
                        <TableHead>{t('tokens.lastUsed')}</TableHead>
                        <TableHead>{t('tokens.expiresAt')}</TableHead>
                        <TableHead className="text-right">{t('tokens.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium">{token.name}</TableCell>
                          <TableCell>
                            {token.lastUsed ? (
                              new Date(token.lastUsed).toLocaleDateString()
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {token.expiresAt ? (
                              new Date(token.expiresAt).toLocaleDateString()
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setTokenToRevoke(token);
                                setShowRevokeDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>SCIM Configuration</AlertTitle>
                <AlertDescription>
                  Configure your Identity Provider to use the SCIM 2.0 endpoint:
                  <br />
                  <code className="mt-2 inline-block bg-muted px-2 py-1 rounded text-sm">
                    {typeof window !== 'undefined' && window.location.origin}/api/scim/v2
                  </code>
                  <br />
                  Use one of the bearer tokens above for authentication.
                </AlertDescription>
              </Alert>
            </>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('logs.title')}</CardTitle>
              <CardDescription>
                View recent SCIM synchronization operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sync logs found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('logs.operation')}</TableHead>
                      <TableHead>{t('logs.resourceType')}</TableHead>
                      <TableHead>{t('logs.resourceId')}</TableHead>
                      <TableHead>{t('logs.status')}</TableHead>
                      <TableHead>{t('logs.timestamp')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{getOperationBadge(log.operation)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.resourceType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.resourceId || log.scimId || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(log.status)}
                            {log.errorMessage && (
                              <p className="text-xs text-destructive">
                                {log.errorMessage}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Token Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SCIM Token</DialogTitle>
            <DialogDescription>
              Create a new bearer token for SCIM 2.0 provisioning. The token will only
              be shown once, so save it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tokenName">Token Name</Label>
              <Input
                id="tokenName"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="e.g., Okta Production, Azure AD Staging"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateToken} disabled={creating || !newTokenName.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Create Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Token Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tokens.revokeConfirm.title')}</DialogTitle>
            <DialogDescription>
              {t('tokens.revokeConfirm.description')}
            </DialogDescription>
          </DialogHeader>
          {tokenToRevoke && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Token: <strong>{tokenToRevoke.name}</strong>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevokeDialog(false);
                setTokenToRevoke(null);
              }}
              disabled={revoking}
            >
              {t('tokens.revokeConfirm.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('tokens.revokeConfirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
