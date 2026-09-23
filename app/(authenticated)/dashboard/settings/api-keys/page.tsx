'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Calendar,
  Shield,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { API_KEY_SCOPES, API_KEY_SCOPE_PRESETS } from '@/lib/permissions-config';

interface ApiKey {
  id: string;
  teamSlug: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

interface CreateApiKeyResponse {
  id: string;
  teamSlug: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  secretKey: string; // Only shown once
}

// Convert scopes to a more UI-friendly format
const SCOPE_OPTIONS = [
  { value: API_KEY_SCOPES.TEAM_READ, label: 'Team Read', description: 'Read team information' },
  { value: API_KEY_SCOPES.TEAM_WRITE, label: 'Team Write', description: 'Modify team settings' },
  { value: API_KEY_SCOPES.RAG_READ, label: 'RAG Read', description: 'Read RAG packages' },
  { value: API_KEY_SCOPES.RAG_WRITE, label: 'RAG Write', description: 'Create/modify RAG packages' },
  { value: API_KEY_SCOPES.RAG_QUERY, label: 'RAG Query', description: 'Query RAG system' },
  { value: API_KEY_SCOPES.RAG_DELETE, label: 'RAG Delete', description: 'Delete RAG packages' },
  { value: API_KEY_SCOPES.DOCUMENTS_READ, label: 'Documents Read', description: 'Read documents' },
  { value: API_KEY_SCOPES.DOCUMENTS_WRITE, label: 'Documents Write', description: 'Upload/modify documents' },
  { value: API_KEY_SCOPES.DOCUMENTS_DELETE, label: 'Documents Delete', description: 'Delete documents' },
  { value: API_KEY_SCOPES.CHAT_READ, label: 'Chat Read', description: 'Read chat conversations' },
  { value: API_KEY_SCOPES.CHAT_WRITE, label: 'Chat Write', description: 'Create chat messages' },
  { value: API_KEY_SCOPES.CHAT_DELETE, label: 'Chat Delete', description: 'Delete chat conversations' },
];

const SCOPE_PRESETS = [
  { name: 'Read Only', value: 'read_only', scopes: API_KEY_SCOPE_PRESETS.read_only },
  { name: 'Full Access', value: 'full_access', scopes: API_KEY_SCOPE_PRESETS.full_access },
  { name: 'RAG Only', value: 'rag_only', scopes: API_KEY_SCOPE_PRESETS.rag_only },
  { name: 'Documents Only', value: 'documents_only', scopes: API_KEY_SCOPE_PRESETS.documents_only },
  { name: 'Chat Only', value: 'chat_only', scopes: API_KEY_SCOPE_PRESETS.chat_only },
];

export default function ApiKeysPage() {
  const user = useUser({ or: 'redirect' });
  const { teamSlug } = useTeam();
  const { toast } = useToast();
  const t = useTranslations('apiKeys');

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // New key form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(API_KEY_SCOPE_PRESETS.read_only);
  const [selectedPreset, setSelectedPreset] = useState<string>('read_only');
  const [newKeyExpirationDays, setNewKeyExpirationDays] = useState<number>(0); // 0 = never expires

  // Generated key (shown only once)
  const [generatedKey, setGeneratedKey] = useState<CreateApiKeyResponse | null>(null);

  useEffect(() => {
    if (teamSlug) {
      fetchApiKeys();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSlug]);

  const fetchApiKeys = async () => {
    if (!teamSlug) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/team/api-keys?teamSlug=${encodeURIComponent(teamSlug)}`);
      const data = await response.json();

      if (response.ok) {
        setApiKeys(data.apiKeys || []);
      } else {
        throw new Error(data.error || 'Failed to fetch API keys');
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to load API keys',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!teamSlug) return;

    if (!newKeyName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      });
      return;
    }

    if (newKeyScopes.length === 0) {
      toast({
        title: 'Scopes Required',
        description: 'Please select at least one scope for the API key',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      const response = await fetch('/api/team/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamSlug,
          name: newKeyName,
          scopes: newKeyScopes,
          expiresIn: newKeyExpirationDays > 0 ? newKeyExpirationDays : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedKey(data);
        setShowCreateDialog(false);
        resetForm();
        await fetchApiKeys();

        toast({
          title: 'API Key Created',
          description: 'Your new API key has been generated',
        });
      } else {
        throw new Error(data.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!teamSlug) return;

    try {
      const response = await fetch(`/api/team/api-keys?teamSlug=${encodeURIComponent(teamSlug)}&keyId=${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchApiKeys();
        toast({
          title: 'API Key Deleted',
          description: 'The API key has been permanently deleted',
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    });
  };

  const resetForm = () => {
    setNewKeyName('');
    setNewKeyScopes(API_KEY_SCOPE_PRESETS.read_only);
    setSelectedPreset('read_only');
    setNewKeyExpirationDays(0);
  };

  const applyPreset = (presetValue: string) => {
    setSelectedPreset(presetValue);
    const preset = SCOPE_PRESETS.find((p) => p.value === presetValue);
    if (preset) {
      setNewKeyScopes(preset.scopes);
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
    // Clear preset when manually modifying scopes
    setSelectedPreset('custom');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  };

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (!teamSlug) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage API keys for programmatic access to your team resources
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for programmatic access. The secret key will only be shown once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Production - CI/CD Pipeline"
                />
                <p className="text-xs text-muted-foreground">
                  A descriptive name to help you identify this key
                </p>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <Label>Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {SCOPE_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      type="button"
                      variant={selectedPreset === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyPreset(preset.value)}
                    >
                      {preset.name}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={selectedPreset === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPreset('custom')}
                  >
                    Custom
                  </Button>
                </div>
              </div>

              {/* Scopes */}
              <div className="space-y-3">
                <Label>Scopes *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SCOPE_OPTIONS.map((scope) => (
                    <div
                      key={scope.value}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={scope.value}
                        checked={newKeyScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={scope.value} className="cursor-pointer font-medium text-sm">
                          {scope.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration</Label>
                <div className="flex gap-2">
                  {[0, 30, 90, 365].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={newKeyExpirationDays === days ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewKeyExpirationDays(days)}
                    >
                      {days === 0 ? 'Never' : days === 30 ? '30 Days' : days === 90 ? '90 Days' : '1 Year'}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {newKeyExpirationDays === 0
                    ? 'This key will not expire unless manually revoked'
                    : `This key will expire in ${newKeyExpirationDays} days`}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateKey} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create API Key'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Generated Key Alert */}
      {generatedKey && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                  Save Your API Key
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This is the only time you&apos;ll see this secret key. Make sure to save it somewhere safe.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-slate-950 px-3 py-2 rounded text-sm font-mono overflow-x-auto">
                    {generatedKey.secretKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedKey.secretKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Key Prefix:</strong> {generatedKey.keyPrefix} (used for identification)
                </div>
              </div>
              <Button onClick={() => setGeneratedKey(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-12">
          <Key className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
          <p className="text-muted-foreground mb-6">
            Create an API key to enable programmatic access to your team resources
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First API Key
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {key.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 3).map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope.split(':')[1] || scope}
                        </Badge>
                      ))}
                      {key.scopes.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{key.scopes.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(key.lastUsed)}
                  </TableCell>
                  <TableCell>
                    {isExpired(key.expiresAt) ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : key.expiresAt ? (
                      <span className="text-sm text-muted-foreground">
                        {formatDate(key.expiresAt)}
                      </span>
                    ) : (
                      <Badge variant="outline">Never</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Any applications using this key will immediately lose access.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteKey(key.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Revoke Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-muted rounded-lg p-6">
        <h3 className="font-semibold mb-3">Using Your API Keys</h3>
        <div className="space-y-3 text-sm">
          <div>
            <strong>Authentication Header:</strong>
            <code className="ml-2 bg-background px-2 py-1 rounded text-xs">
              Authorization: Bearer nxk_...
            </code>
          </div>
          <div>
            <strong>Example:</strong>
            <pre className="mt-1 bg-background p-3 rounded text-xs overflow-x-auto">
{`curl -X GET https://your-app.com/api/chat \\
  -H &quot;Authorization: Bearer nxk_your_key_here&quot;`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
