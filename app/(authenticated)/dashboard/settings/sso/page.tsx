'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, CheckCircle, XCircle, Download, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import type { SAMLConfig } from '@/lib/saml/saml-provider';

type ConfigStatus = {
  configured: boolean;
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpSloUrl?: string;
  idpCert?: string;
  spEntityId?: string;
  acsUrl?: string;
  sloUrl?: string;
  metadataUrl?: string;
  message?: string;
};

type IdPTemplate = {
  id: string;
  name: string;
  instructions: string;
};

export default function SSOSettingsPage() {
  const t = useTranslations('settings.sso');
  const { teamSlug, isOwner, isGlobalAdmin, isLoading: authLoading } = useTeam();

  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedIdp, setSelectedIdp] = useState<string>('manual');
  const [idpTemplates, setIdpTemplates] = useState<IdPTemplate[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    idpEntityId: '',
    idpSsoUrl: '',
    idpSloUrl: '',
    idpCert: '',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  });

  useEffect(() => {
    if (teamSlug) {
      fetchConfig();
      fetchIdpTemplates();
    }
  }, [teamSlug]);

  async function fetchConfig() {
    if (!teamSlug) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/saml/config?teamSlug=${teamSlug}`);
      if (res.ok) {
        const data = await res.json();
        setConfigStatus(data);

        // Pre-fill form if configured
        if (data.configured) {
          setFormData({
            idpEntityId: data.idpEntityId || '',
            idpSsoUrl: data.idpSsoUrl || '',
            idpSloUrl: data.idpSloUrl || '',
            idpCert: '',
            nameIdFormat: data.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          });
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to fetch SAML configuration');
      }
    } catch (err) {
      console.error('Error fetching SAML config:', err);
      setError('Failed to fetch SAML configuration');
    } finally {
      setLoading(false);
    }
  }

  async function fetchIdpTemplates() {
    try {
      const res = await fetch('/api/saml/config/templates');
      if (res.ok) {
        const data = await res.json();
        setIdpTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching IdP templates:', err);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!teamSlug) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const endpoint = configStatus?.configured
        ? '/api/saml/config'
        : '/api/saml/config';

      const method = configStatus?.configured ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamSlug,
          ...formData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(true);
        await fetchConfig();

        // Reset success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to save SAML configuration');
      }
    } catch (err) {
      console.error('Error saving SAML config:', err);
      setError('Failed to save SAML configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!teamSlug) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/saml/config?teamSlug=${teamSlug}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchConfig();
        setFormData({
          idpEntityId: '',
          idpSsoUrl: '',
          idpSloUrl: '',
          idpCert: '',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        });
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(err.error || 'Failed to delete SAML configuration');
      }
    } catch (err) {
      console.error('Error deleting SAML config:', err);
      setError('Failed to delete SAML configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadMetadata() {
    if (!teamSlug) return;

    try {
      const res = await fetch(`/api/saml/metadata/${teamSlug}?download=true`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saml-metadata-${teamSlug}.xml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to download metadata');
      }
    } catch (err) {
      console.error('Error downloading metadata:', err);
      setError('Failed to download metadata');
    }
  }

  async function handleCopyMetadataUrl() {
    if (!configStatus?.metadataUrl) return;

    try {
      await navigator.clipboard.writeText(configStatus.metadataUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  }

  function handleIdpTemplateChange(idpId: string) {
    setSelectedIdp(idpId);

    if (idpId !== 'manual') {
      // Pre-fill with template values if available
      // This would be enhanced with actual template data
      setFormData((prev) => ({
        ...prev,
        idpEntityId: '',
        idpSsoUrl: '',
        idpSloUrl: '',
      }));
    }
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
        <p className="text-muted-foreground">You do not have permission to manage SSO settings.</p>
      </div>
    );
  }

  const selectedTemplate = idpTemplates.find((t) => t.id === selectedIdp);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Single Sign-On (SSO)</h1>
          <p className="text-sm text-muted-foreground">
            Configure SAML 2.0 SSO for your team using Okta, Azure AD, or other identity providers
          </p>
        </div>

        {configStatus?.configured && (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Configured
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
          Configuration saved successfully
        </div>
      )}

      {/* Configuration Status Card */}
      {configStatus?.configured ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              SAML is Configured
            </CardTitle>
            <CardDescription>
              Your team is using SAML SSO for authentication. Here are your service provider details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SP Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">SP Entity ID</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                  {configStatus.spEntityId}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ACS URL</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                  {configStatus.acsUrl}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleDownloadMetadata} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Metadata XML
              </Button>
              <Button onClick={handleCopyMetadataUrl} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Copy Metadata URL
              </Button>
              <Button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, idpCert: '' }));
                }}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Update Configuration
              </Button>
            </div>

            {/* Delete Configuration */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete SAML Configuration
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete SAML Configuration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disable SAML SSO for your team. Users will need to sign in using other methods.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configure SAML 2.0 SSO</CardTitle>
            <CardDescription>
              Set up single sign-on for your team by connecting with your identity provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {/* IdP Template Selection */}
              <div>
                <Label>Identity Provider</Label>
                <Select value={selectedIdp} onValueChange={handleIdpTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your identity provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Configuration</SelectItem>
                    {idpTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IdP Instructions */}
              {selectedIdp !== 'manual' && selectedTemplate && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="prose prose-sm max-w-none">
                      <h4 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {selectedTemplate.name} Setup Instructions
                      </h4>
                      <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded">
                        {selectedTemplate.instructions}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* IdP Entity ID */}
              <div>
                <Label htmlFor="idpEntityId">Identity Provider Entity ID *</Label>
                <Input
                  id="idpEntityId"
                  value={formData.idpEntityId}
                  onChange={(e) => setFormData({ ...formData, idpEntityId: e.target.value })}
                  placeholder="https://idp.example.com/entityid"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The unique identifier for your Identity Provider
                </p>
              </div>

              {/* IdP SSO URL */}
              <div>
                <Label htmlFor="idpSsoUrl">IdP Single Sign-On URL *</Label>
                <Input
                  id="idpSsoUrl"
                  value={formData.idpSsoUrl}
                  onChange={(e) => setFormData({ ...formData, idpSsoUrl: e.target.value })}
                  placeholder="https://idp.example.com/sso"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The URL where users will be redirected for authentication
                </p>
              </div>

              {/* IdP SLO URL (Optional) */}
              <div>
                <Label htmlFor="idpSloUrl">IdP Single Logout URL</Label>
                <Input
                  id="idpSloUrl"
                  value={formData.idpSloUrl}
                  onChange={(e) => setFormData({ ...formData, idpSloUrl: e.target.value })}
                  placeholder="https://idp.example.com/slo"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: URL for single logout functionality
                </p>
              </div>

              {/* IdP X.509 Certificate */}
              <div>
                <Label htmlFor="idpCert">IdP X.509 Certificate *</Label>
                <Textarea
                  id="idpCert"
                  value={formData.idpCert}
                  onChange={(e) => setFormData({ ...formData, idpCert: e.target.value })}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  rows={8}
                  className="font-mono text-sm"
                  required={configStatus?.configured ? false : true}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the full X.509 certificate from your Identity Provider
                </p>
              </div>

              {/* Name ID Format */}
              <div>
                <Label>Name ID Format</Label>
                <Select
                  value={formData.nameIdFormat}
                  onValueChange={(value) => setFormData({ ...formData, nameIdFormat: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
                      Email Address
                    </SelectItem>
                    <SelectItem value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">
                      Unspecified
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save SAML Configuration'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
