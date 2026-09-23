"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText, Package, PlusCircle, Upload, Trash2, X, RotateCcw, Trash, CheckSquare, Square } from 'lucide-react';

import { useTeam } from '@/hooks/use-team';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RagPackageSummary, RagDocument } from '@/lib/rag/types';
import { RagPackagesDashboardSkeleton } from '@/components/chat-skeleton';
import { PermissionGate } from '@/components/auth/permission-gate';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

type CreatePackagePayload = {
  name: string;
  description?: string;
};

type PackagesResponse = {
  success: boolean;
  packages?: RagPackageSummary[];
  error?: string;
  details?: unknown;
};

type CreatePackageResponse = {
  success: boolean;
  package?: RagPackageSummary;
  error?: string;
  details?: unknown;
};

type UploadDocumentsResponse = {
  success: boolean;
  package?: RagPackageSummary;
  processed?: Array<{ filename: string; chunkCount: number; pointIds: string[] }>;
  failures?: Array<{ filename: string; error: string }>;
  error?: string;
  details?: unknown;
};

type DeleteDocumentResponse = {
  success: boolean;
  package?: RagPackageSummary;
  error?: string;
  message?: string;
};

type DeletedDocumentsResponse = {
  success: boolean;
  documents?: RagDocument[];
  error?: string;
  message?: string;
};

type RestoreDocumentResponse = {
  success: boolean;
  package?: RagPackageSummary;
  error?: string;
  message?: string;
};

export default function TeamRagDashboard() {
  const { isOwner, teamSlug } = useTeam();
  const { toast } = useToast();
  const t = useTranslations('dashboard.rag');
  const [packages, setPackages] = useState<RagPackageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingDocumentIds, setRemovingDocumentIds] = useState<Record<string, boolean>>({});
  const [showTrash, setShowTrash] = useState(false);
  const [restoringDocumentIds, setRestoringDocumentIds] = useState<Record<string, boolean>>({});
  const [docTrash, setDocTrash] = useState<Record<string, { open: boolean; loading: boolean; items: RagDocument[] }>>({});
  const [docSelected, setDocSelected] = useState<Record<string, Record<string, boolean>>>({});
  const [docsPagination, setDocsPagination] = useState<Record<string, { page: number; perPage: number }>>({});

  useEffect(() => {
    if (!isOwner) {
      setPackages([]);
      return;
    }

    const fetchPackages = async () => {
      setLoading(true);
      try {
        const res = await fetch(showTrash ? '/api/rag/packages?include=deleted' : '/api/rag/packages');
        const data = (await res.json()) as PackagesResponse;
        if (res.ok && data.success && Array.isArray(data.packages)) {
          setPackages(data.packages);
        } else {
          toast({
            title: t('packages.loadError'),
            description: t('packages.loadRetry'),
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to fetch RAG packages', error);
        toast({
          title: t('connectionError'),
          description: t('ragDataLoadError'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [isOwner, showTrash, t, toast]);

  const handlePackageCreated = (pkg: RagPackageSummary) => {
    setPackages((prev: RagPackageSummary[]) => [pkg, ...prev]);
  };

  const handlePackageUpdated = (pkg: RagPackageSummary) => {
    setPackages((prev: RagPackageSummary[]) => {
      // Create a new array with the updated package to ensure React detects the change
      return prev.map((item: RagPackageSummary) => (item.id === pkg.id ? { ...pkg } : item));
    });
  };

  const handleRemoveStoredDocument = async (packageId: string, documentId: string) => {
    setRemovingDocumentIds((prev: Record<string, boolean>) => ({ ...prev, [documentId]: true }));
    try {
      const res = await fetch(`/api/rag/packages/${packageId}/documents/${documentId}`, { method: 'DELETE' });
      const data = (await res.json()) as DeleteDocumentResponse & { warning?: string; qdrantDeleted?: boolean };

      if (res.ok && data.success && data.package) {
        setPackages((prev: RagPackageSummary[]) => prev.map((pkg: RagPackageSummary) => (pkg.id === packageId ? data.package! : pkg)));

        if (data.warning && !data.qdrantDeleted) {
          toast({
            title: t('documentMovedToTrash'),
            description: data.warning,
            variant: 'default'
          });
        } else {
          toast({ title: t('documentMovedToTrash'), description: t('documentSentToTrash') });
        }
      } else {
        toast({
          title: t('couldNotMoveToTrash'),
          description: data.message || data.error || t('pleaseTryAgain'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to remove document', error);
      toast({
        title: t('connectionError'),
        description: t('couldNotConnectToServer'),
        variant: 'destructive',
      });
    } finally {
      setRemovingDocumentIds((prev: Record<string, boolean>) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    }
  };

  const toggleSelectDoc = (packageId: string, documentId: string) => {
    setDocSelected((prev) => {
      const pkgSel = prev[packageId] || {};
      const nextPkgSel = { ...pkgSel, [documentId]: !pkgSel[documentId] };
      return { ...prev, [packageId]: nextPkgSel };
    });
  };

  const selectedIdsFor = (packageId: string): string[] => {
    const pkgSel = docSelected[packageId] || {};
    return Object.keys(pkgSel).filter((id) => pkgSel[id]);
  };

  const selectAllDocs = (packageId: string) => {
    const items = docTrash[packageId]?.items || [];
    const all: Record<string, boolean> = {};
    items.forEach((d) => (all[d.id] = true));
    setDocSelected((prev) => ({ ...prev, [packageId]: all }));
  };

  const clearSelection = (packageId: string) => {
    setDocSelected((prev) => ({ ...prev, [packageId]: {} }));
  };

  const handleBulkRestore = async (packageId: string) => {
    const ids = selectedIdsFor(packageId);
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/rag/packages/${packageId}/documents/bulk/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.package) {
        setPackages((prev: RagPackageSummary[]) => prev.map((p) => (p.id === packageId ? data.package : p)));
        setDocTrash((prev) => {
          const state = prev[packageId] || { open: true, loading: false, items: [] };
          return { ...prev, [packageId]: { ...state, items: state.items.filter((d) => !ids.includes(d.id)) } };
        });
        clearSelection(packageId);
        toast({ title: t('documentsRestored'), description: t('restoredCount', { count: ids.length }) });
      } else {
        toast({ title: t('couldNotRestoreDocuments'), variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: t('networkError'), description: t('couldNotRestore'), variant: 'destructive' });
    }
  };

  const handleBulkDelete = async (packageId: string) => {
    const ids = selectedIdsFor(packageId);
    if (ids.length === 0) return;
    if (!confirm(t('confirmPermanentDeleteDocuments', { count: ids.length }))) return;
    try {
      const res = await fetch(`/api/rag/packages/${packageId}/documents/bulk/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, hard: true }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setDocTrash((prev) => {
          const state = prev[packageId] || { open: true, loading: false, items: [] };
          return { ...prev, [packageId]: { ...state, items: state.items.filter((d) => !ids.includes(d.id)) } };
        });
        if (data.package) {
          setPackages((prev: RagPackageSummary[]) => prev.map((p) => (p.id === packageId ? data.package : p)));
        }
        clearSelection(packageId);
        toast({ title: t('deleted'), description: t('deletedCount', { count: ids.length }) });
      } else {
        toast({ title: t('couldNotDelete'), variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: t('networkError'), description: t('couldNotDelete'), variant: 'destructive' });
    }
  };

  const toggleDocTrash = async (packageId: string) => {
    setDocTrash((prev) => {
      const current = prev[packageId] || { open: false, loading: false, items: [] };
      const next = { ...prev, [packageId]: { ...current, open: !current.open } };
      return next;
    });
    const state = docTrash[packageId];
    const willOpen = !(state?.open);
    if (willOpen && (!state || state.items.length === 0)) {
      setDocTrash((prev) => ({ ...prev, [packageId]: { open: true, loading: true, items: [] } }));
      try {
        const res = await fetch(`/api/rag/packages/${packageId}/documents/deleted`);
        const data = (await res.json()) as DeletedDocumentsResponse;
        if (res.ok && data.success && Array.isArray(data.documents)) {
          setDocTrash((prev) => ({ ...prev, [packageId]: { open: true, loading: false, items: data.documents! } }));
          setDocSelected((prev) => ({ ...prev, [packageId]: {} }));
        } else {
          setDocTrash((prev) => ({ ...prev, [packageId]: { open: true, loading: false, items: [] } }));
          toast({ title: t('couldNotLoadTrash'), variant: 'destructive' });
        }
      } catch (e) {
        setDocTrash((prev) => ({ ...prev, [packageId]: { open: true, loading: false, items: [] } }));
        toast({ title: t('networkError'), description: t('couldNotLoadTrash'), variant: 'destructive' });
      }
    }
  };

  const handleRestoreDocument = async (packageId: string, documentId: string) => {
    setRestoringDocumentIds((prev) => ({ ...prev, [documentId]: true }));
    try {
      const res = await fetch(`/api/rag/packages/${packageId}/documents/${documentId}/restore`, { method: 'POST' });
      const data = (await res.json()) as RestoreDocumentResponse;
      if (res.ok && data.success && data.package) {
        setPackages((prev: RagPackageSummary[]) => prev.map((pkg: RagPackageSummary) => (pkg.id === packageId ? data.package! : pkg)));
        setDocTrash((prev) => {
          const state = prev[packageId] || { open: true, loading: false, items: [] };
          return { ...prev, [packageId]: { ...state, items: state.items.filter((d) => d.id !== documentId) } };
        });
        toast({ title: t('documentRestored'), description: t('documentRestoredSuccessfully') });
      } else {
        toast({ title: t('couldNotRestore'), description: data.message || data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: t('error'), description: t('couldNotRestoreDocument'), variant: 'destructive' });
    } finally {
      setRestoringDocumentIds((prev) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    }
  };

  const handleEmptyTrash = async (packageId: string) => {
    const trashItems = docTrash[packageId]?.items || [];
    if (trashItems.length === 0) {
      toast({ title: t('trashAlreadyEmpty'), variant: 'default' });
      return;
    }

    if (!confirm(t('confirmEmptyTrash', { count: trashItems.length }))) return;

    try {
      const res = await fetch(`/api/rag/packages/${packageId}/documents/empty-trash`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setDocTrash((prev) => ({ ...prev, [packageId]: { open: true, loading: false, items: [] } }));
        if (data.package) {
          setPackages((prev: RagPackageSummary[]) => prev.map((p) => (p.id === packageId ? data.package : p)));
        }
        clearSelection(packageId);
        toast({ title: t('trashEmptied'), description: t('permanentlyDeletedCount', { count: data.deletedCount || 0 }) });
      } else {
        toast({ title: t('couldNotEmptyTrash'), description: data.error || t('unknownError'), variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: t('networkError'), description: t('couldNotEmptyTrash'), variant: 'destructive' });
    }
  };

  // Use PermissionGate to check if user can view RAG packages
  const fallbackComponent = (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>{t('accessRestricted')}</CardTitle>
            <CardDescription>
              {t('onlyTeamAdminsCanManageRagPackages')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('pleaseAskAdminForPermissionsOrReturnTo')}{' '}
              <Link href="/dashboard" className="underline hover:text-foreground">
                {t('mainDashboard')}
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (!teamSlug) {
    return fallbackComponent;
  }

  return (
    <PermissionGate
      permission="rag.query"
      teamSlug={teamSlug}
      fallback={fallbackComponent}
    >
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('teamLabel', { teamSlug: teamSlug || 'Unknown' })}</p>
              <h1 className="text-2xl font-semibold text-foreground">{t('ragPackageManagement')}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('uploadDocumentsCreateEmbeddingsForCompanyChat')}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button variant="outline">{t('back')}</Button>
              </Link>
              <PermissionGate permission="rag.create" teamSlug={teamSlug}>
                <CreatePackageDialog onCreated={handlePackageCreated} />
              </PermissionGate>
              <Button variant={showTrash ? 'default' : 'outline'} onClick={() => setShowTrash((v) => !v)}>
                {showTrash ? t('hideTrash') : t('showTrash')}
              </Button>
            </div>
          </div>
        </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {loading ? (
          <RagPackagesDashboardSkeleton count={4} />
        ) : packages.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('noPackagesConfigured')}</CardTitle>
              <CardDescription>
                {t('createFirstRagPackageToVectorizeTeamDocuments')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreatePackageDialog
                onCreated={handlePackageCreated}
                trigger={
                  <Button className="w-full">
                    <PlusCircle className="h-4 w-4 mr-2" /> {t('createRagPackage')}
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {packages.map((pkg) => (
              <Card key={pkg.id} className="flex flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {pkg.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t('documentsCount', { count: pkg.documentCount })}</Badge>
                      <PermissionGate permission="rag.delete" teamSlug={teamSlug} fallback={null}>
                        {!showTrash ? (
                          <Button variant="destructive" size="sm" onClick={async () => {
                            if (!confirm(t('confirmSendToTrash', { name: pkg.name }))) return;
                            const res = await fetch(`/api/rag/packages/${pkg.id}`, { method: 'DELETE' });
                            if (res.ok) {
                              setPackages((prev: any[]) => prev.filter((p) => p.id !== pkg.id));
                              toast({ title: t('sentToTrash'), description: pkg.name });
                            } else {
                              toast({ title: t('error'), description: t('couldNotMoveToTrash'), variant: 'destructive' });
                            }
                          }}>
                            {t('trash')}
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={async () => {
                              const res = await fetch(`/api/rag/packages/${pkg.id}/restore`, { method: 'POST' });
                              if (res.ok) {
                                setPackages((prev: any[]) => prev.filter((p) => p.id !== pkg.id));
                                toast({ title: t('restored'), description: pkg.name });
                              } else {
                                toast({ title: t('error'), description: t('couldNotRestore'), variant: 'destructive' });
                              }
                            }}>
                              {t('restore')}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={async () => {
                              if (!confirm(t('confirmPermanentDelete', { name: pkg.name }))) return;
                              const res = await fetch(`/api/rag/packages/${pkg.id}?hard=1`, { method: 'DELETE' });
                              if (res.ok) {
                                setPackages((prev: any[]) => prev.filter((p) => p.id !== pkg.id));
                                toast({ title: t('permanentlyDeleted'), description: pkg.name });
                              } else {
                                toast({ title: t('error'), description: t('couldNotDelete'), variant: 'destructive' });
                              }
                            }}>
                              {t('delete')}
                            </Button>
                          </>
                        )}
                      </PermissionGate>
                    </div>
                  </div>
                  {pkg.description ? (
                    <CardDescription>{pkg.description}</CardDescription>
                  ) : (
                    <CardDescription>{t('packageWithoutDescription')}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    <p>{t('collection')}: {pkg.collectionName}</p>
                    <p>{t('vectorizedChunks')}: {pkg.totalChunks}</p>
                    <p>{t('lastUpdate')}: {formatDate(pkg.updatedAt)}</p>
                  </div>

                  {/* Knowledge Graph button */}
                  {!showTrash && pkg.documentCount > 0 && (
                    <Link href={`/dashboard/rag/${pkg.id}/graph`} className="w-full">
                      <Button variant="outline" className="w-full" size="sm">
                        <svg
                          className="h-4 w-4 mr-2"
                          fill="none"
                          strokeWidth="2"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25a8.25 8.25 0 0 0 7.5-4.86 8.25 8.25 0 1 0-15 0A8.25 8.25 0 0 0 12 20.25Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25v.5m0-11.25v.5m5.303 5.303-.707.707M6.697 17.303l-.707.707m12.02 0-.707-.707M6.697 6.697l-.707-.707" />
                        </svg>
                        {t('viewGraph')}
                      </Button>
                    </Link>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> {t('uploadedDocuments')}
                    </h3>
                    {pkg.documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('noDocumentsUploaded')}</p>
                    ) : (
                      <>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {(() => {
                            const pagination = docsPagination[pkg.id] || { page: 1, perPage: 5 };
                            const startIndex = (pagination.page - 1) * pagination.perPage;
                            const endIndex = startIndex + pagination.perPage;
                            const paginatedDocs = pkg.documents.slice(startIndex, endIndex);

                            return paginatedDocs.map((doc: RagDocument) => (
                              <li key={doc.id} className="flex items-center justify-between gap-2">
                                <span className="truncate" title={doc.filename}>
                                  {doc.filename}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{t('chunksCount', { count: doc.chunkCount })}</Badge>
                                  <PermissionGate permission="rag.delete" teamSlug={teamSlug} fallback={null}>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveStoredDocument(pkg.id, doc.id)}
                                      disabled={Boolean(removingDocumentIds[doc.id])}
                                      title={t('removeDocument')}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </PermissionGate>
                                </div>
                              </li>
                            ));
                          })()}
                        </ul>
                        {pkg.documents.length > 5 && (() => {
                          const pagination = docsPagination[pkg.id] || { page: 1, perPage: 5 };
                          const totalPages = Math.ceil(pkg.documents.length / pagination.perPage);

                          return (
                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {t('showing')} {Math.min((pagination.page - 1) * pagination.perPage + 1, pkg.documents.length)}-{Math.min(pagination.page * pagination.perPage, pkg.documents.length)} {t('of')} {pkg.documents.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDocsPagination((prev) => ({
                                      ...prev,
                                      [pkg.id]: { ...pagination, page: Math.max(1, pagination.page - 1) }
                                    }));
                                  }}
                                  disabled={pagination.page === 1}
                                  className="h-7 px-2 text-xs"
                                >
                                  {t('previous')}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  {pagination.page} / {totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDocsPagination((prev) => ({
                                      ...prev,
                                      [pkg.id]: { ...pagination, page: Math.min(totalPages, pagination.page + 1) }
                                    }));
                                  }}
                                  disabled={pagination.page >= totalPages}
                                  className="h-7 px-2 text-xs"
                                >
                                  {t('next')}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-foreground">{t('documentsTrash')}</h3>
                      <Button variant="outline" size="sm" onClick={() => toggleDocTrash(pkg.id)}>
                        {docTrash[pkg.id]?.open ? t('hide') : t('show')}
                      </Button>
                    </div>
                    {docTrash[pkg.id]?.open && (
                      <div className="rounded-lg border border-dashed border-border p-3 text-sm">
                        {docTrash[pkg.id]?.loading ? (
                          <p className="text-muted-foreground">{t('loadingDeletedDocuments')}</p>
                        ) : (docTrash[pkg.id]?.items?.length ?? 0) === 0 ? (
                          <p className="text-muted-foreground">{t('noDocumentsInTrash')}</p>
                        ) : (
                          <>
                            {/* Bulk Actions Header */}
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const selected = selectedIdsFor(pkg.id);
                                    const total = docTrash[pkg.id]?.items?.length || 0;
                                    if (selected.length === total) {
                                      clearSelection(pkg.id);
                                    } else {
                                      selectAllDocs(pkg.id);
                                    }
                                  }}
                                  className="p-1"
                                >
                                  {(() => {
                                    const selected = selectedIdsFor(pkg.id);
                                    const total = docTrash[pkg.id]?.items?.length || 0;
                                    if (selected.length === 0) {
                                      return <Square className="h-4 w-4" />;
                                    } else if (selected.length === total) {
                                      return <CheckSquare className="h-4 w-4" />;
                                    } else {
                                      return <CheckSquare className="h-4 w-4 opacity-50" />;
                                    }
                                  })()}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  {selectedIdsFor(pkg.id).length} {t('selected')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {selectedIdsFor(pkg.id).length > 0 && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleBulkRestore(pkg.id)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      {t('restore')}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleBulkDelete(pkg.id)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Trash className="h-3 w-3 mr-1" />
                                      {t('delete')}
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleEmptyTrash(pkg.id)}
                                  className="h-7 px-2 text-xs"
                                  title={t('emptyAllTrash')}
                                >
                                  <Trash className="h-3 w-3 mr-1" />
                                  {t('emptyTrash')}
                                </Button>
                              </div>
                            </div>

                            {/* Document List */}
                            <ul className="space-y-2">
                              {docTrash[pkg.id]!.items.map((d) => (
                                <li key={d.id} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Checkbox
                                      checked={docSelected[pkg.id]?.[d.id] || false}
                                      onCheckedChange={() => toggleSelectDoc(pkg.id, d.id)}
                                    />
                                    <span className="truncate" title={d.filename}>{d.filename}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{t('chunksCount', { count: d.chunkCount })}</Badge>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRestoreDocument(pkg.id, d.id)}
                                      disabled={Boolean(restoringDocumentIds[d.id])}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      {t('restore')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={async () => {
                                        if (!confirm(t('confirmPermanentDeleteDocument', { filename: d.filename }))) return;
                                        try {
                                          const res = await fetch(`/api/rag/packages/${pkg.id}/documents/${d.id}?hard=1`, { method: 'DELETE' });
                                          const data = await res.json();
                                          if (res.ok && data?.success) {
                                            setDocTrash((prev) => {
                                              const state = prev[pkg.id] || { open: true, loading: false, items: [] };
                                              return { ...prev, [pkg.id]: { ...state, items: state.items.filter((x) => x.id !== d.id) } };
                                            });
                                            if (data.package) {
                                              setPackages((prev: RagPackageSummary[]) => prev.map((p) => (p.id === pkg.id ? data.package : p)));
                                            }
                                            toast({ title: t('deleted'), description: d.filename });
                                          } else {
                                            toast({ title: t('couldNotDelete'), variant: 'destructive' });
                                          }
                                        } catch (e) {
                                          toast({ title: t('networkError'), description: t('couldNotDelete'), variant: 'destructive' });
                                        }
                                      }}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Trash className="h-3 w-3 mr-1" />
                                      {t('delete')}
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
                <div className="px-6 pb-6">
                  <UploadDocumentDialog ragPackage={pkg} onPackageUpdated={handlePackageUpdated} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
    </PermissionGate>
  );
}

type CreatePackageDialogProps = {
  onCreated: (pkg: RagPackageSummary) => void;
  trigger?: ReactNode;
};

function CreatePackageDialog({ onCreated, trigger }: CreatePackageDialogProps) {
  const t = useTranslations('dashboard.rag');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreatePackagePayload>({ name: '', description: '' });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/rag/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as UploadDocumentsResponse;
      if (res.ok && data.success && data.package) {
        onCreated(data.package);
        toast({ title: t('packageCreated'), description: t('nowYouCanUploadDocuments') });
        setForm({ name: '', description: '' });
        setOpen(false);
      } else {
        toast({
          title: t('couldNotCreatePackage'),
          description: t('pleaseCheckDataAndTryAgain'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to create package', error);
      toast({
        title: t('networkError'),
        description: t('pleaseTryAgainInAFewMoments'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const triggerNode = trigger ?? (
    <Button type="button">
      <PlusCircle className="h-4 w-4 mr-2" /> {t('createRagPackage')}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newRagPackage')}</DialogTitle>
          <DialogDescription>
            {t('groupVectorizedDocumentsByAreaDomainOrCustomer')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rag-name">{t('name')}</Label>
            <Input
              id="rag-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={t('supportRepository')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rag-description">{t('description')}</Label>
            <Textarea
              id="rag-description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder={t('documentationAndGuidelinesForSupportArea')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || form.name.trim().length < 3}>
            {submitting ? t('creating') : t('createPackage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UploadDocumentDialogProps = {
  ragPackage: RagPackageSummary;
  onPackageUpdated: (pkg: RagPackageSummary) => void;
};

function UploadDocumentDialog({ ragPackage, onPackageUpdated }: UploadDocumentDialogProps) {
  const t = useTranslations('dashboard.rag');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [fileProgress, setFileProgress] = useState<Record<string, { status: 'pending' | 'uploading' | 'done' | 'error'; progress: number; error?: string }>>({});

  const removeFileFromSelection = (index: number) => {
    setFiles((prev: File[]) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    try {
      // Upload one by one to show progress
      const totalBytes = files.reduce((s, f) => s + f.size, 0);
      let uploadedBytes = 0;
      let anyProcessed = false;
      let lastPackageUpdate: RagPackageSummary | null = null;

      for (const file of files) {
        const fileKey = `${file.name}-${file.size}`;
        setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'uploading', progress: 0 } }));

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/rag/packages/${ragPackage.id}/documents`);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const current = uploadedBytes + e.loaded;
              setProgress(Math.min(99, Math.round((current / totalBytes) * 100)));
              setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'uploading', progress: Math.round((e.loaded / e.total) * 100) } }));
            }
          };
          xhr.onload = async () => {
            uploadedBytes += file.size;
            try {
              const resp = JSON.parse(xhr.responseText || '{}') as UploadDocumentsResponse;
              if (xhr.status >= 200 && xhr.status < 300) {
                setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'done', progress: 100 } }));
                if (resp.package) {
                  lastPackageUpdate = resp.package;
                  anyProcessed = true;
                }
                const fails = Array.isArray(resp.failures) ? resp.failures : [];
                if (fails.length) {
                  setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'error', progress: 100, error: fails[0]?.error } }));
                  toast({ title: t('processingError'), description: fails.map(f => `${f.filename}: ${f.error}`).join(' | '), variant: 'destructive' });
                }
                resolve();
              } else {
                setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'error', progress: 100, error: resp.error } }));
                toast({ title: t('uploadError'), description: resp.error || xhr.statusText, variant: 'destructive' });
                resolve();
              }
            } catch (e) {
              setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'error', progress: 100 } }));
              resolve();
            }
          };
          xhr.onerror = () => {
            uploadedBytes += file.size;
            setFileProgress(prev => ({ ...prev, [fileKey]: { status: 'error', progress: 100, error: 'Network error' } }));
            toast({ title: t('networkError'), description: t('couldNotUploadFile'), variant: 'destructive' });
            resolve();
          };
          const fd = new FormData();
          fd.append('files', file);
          xhr.send(fd);
        });
      }
      setProgress(100);

      // Force final update after all uploads complete
      if (anyProcessed && lastPackageUpdate) {
        // Fetch fresh package data to ensure we have the latest state
        try {
          const refreshRes = await fetch(`/api/rag/packages/${ragPackage.id}`);
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.package) {
              onPackageUpdated(refreshData.package);
            } else if (lastPackageUpdate) {
              // Fallback to last update from upload
              onPackageUpdated(lastPackageUpdate);
            }
          } else if (lastPackageUpdate) {
            // Fallback to last update from upload
            onPackageUpdated(lastPackageUpdate);
          }
        } catch (refreshError) {
          console.error('Failed to refresh package data:', refreshError);
          // Fallback to last update from upload
          if (lastPackageUpdate) {
            onPackageUpdated(lastPackageUpdate);
          }
        }

        toast({
          title: t('uploadCompleted'),
          description: t('processedCount', { count: files.length })
        });
      } else {
        toast({
          title: t('uploadError'),
          description: t('couldNotProcessAnyFileCheckFormat'),
          variant: 'destructive'
        });
      }

      setFiles([]);
      setOpen(false);
    } catch (error) {
      console.error('Failed to upload document', error);
      toast({
        title: files.length > 1 ? t('errorUploadingDocuments') : t('errorUploadingDocument'),
        description: t('serverCouldNotBeReached'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setProgress(0);
      setFileProgress({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setFiles([]); } }}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="secondary" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> {t('uploadDocuments')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('uploadDocuments')}</DialogTitle>
          <DialogDescription>
            {t('supportedTextFilesTxtMdJsonPdfDocDocxEmbeddingsCreatedAutomaticallyInQdrant')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            type="file"
            multiple
            accept=".txt,.md,.json,.pdf,.doc,.docx,text/plain,text/markdown,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              const MAX_MB = 25;
              const supported = (f: File) => {
                const ct = (f.type || '').toLowerCase();
                const name = f.name.toLowerCase();
                return (
                  ct.startsWith('text/') ||
                  ct.includes('markdown') ||
                  ct.includes('json') ||
                  ct.includes('pdf') || /\.pdf$/.test(name) ||
                  ct.includes('word') || /\.(docx?|odt)$/.test(name)
                );
              };
              const valid: File[] = [];
              const rejected: string[] = [];
              selected.forEach((f) => {
                if (f.size > MAX_MB * 1024 * 1024) {
                  rejected.push(t('fileExceedsSize', { name: f.name, max: MAX_MB }));
                } else if (!supported(f)) {
                  rejected.push(t('unsupportedFileType', { name: f.name }));
                } else {
                  valid.push(f);
                }
              });
              setFiles(valid);
              if (rejected.length) {
                toast({ title: t('someFilesNotSelected'), description: rejected.join(' | '), variant: 'destructive' });
              }
            }}
          />
          {files.length > 0 && (
            <div className="space-y-2 text-sm">
              {files.map((file: File, index: number) => {
                const fileKey = `${file.name}-${file.size}`;
                const fp = fileProgress[fileKey];
                return (
                  <div key={fileKey} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        {fp?.status === 'done' && <span className="text-green-500">✓</span>}
                        {fp?.status === 'error' && <span className="text-red-500">✗</span>}
                        {fp?.status === 'uploading' && <span className="text-blue-500 animate-pulse">●</span>}
                        <strong className="truncate max-w-[200px]">{file.name}</strong>
                        <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                      </span>
                      {!uploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFileFromSelection(index)}
                          title={t('removeFile')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {fp?.status === 'uploading' && (
                      <div className="w-full h-1 bg-muted rounded overflow-hidden">
                        <div className="h-1 bg-blue-500 transition-all" style={{ width: `${fp.progress}%` }} />
                      </div>
                    )}
                    {fp?.status === 'error' && fp.error && (
                      <p className="text-xs text-red-500 truncate">{fp.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <div className="flex-1 mr-4">
            {uploading && (
              <div className="w-full h-2 bg-muted rounded overflow-hidden">
                <div className="h-2 bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
            {t('cancel')}
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
            {uploading ? t('uploadingIndexing') : t('processDocuments', { count: files.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
