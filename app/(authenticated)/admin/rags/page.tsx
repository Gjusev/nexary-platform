'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Rag = {
  id: string;
  name: string;
  team_slug?: string;
  scope?: string;
  collection_name?: string;
};

export default function AdminRagsPage() {
  const t = useTranslations('admin');
  const toast = useToast();
  const { roles, isLoading } = useTeam();
  const isGlobal = roles.some((r: string) => r === 'global-admin' || r === 'global-rag-admin');
  const [rags, setRags] = useState<Rag[]>([]);
  const [assign, setAssign] = useState({ ragId: '', teamSlug: '', policy: 'read-only', can_query: true, can_ingest: false, can_update: false, can_delete: false });
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [trashCount, setTrashCount] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRagId, setDeleteRagId] = useState<string | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreRagId, setRestoreRagId] = useState<string | null>(null);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [permanentDeleteRagId, setPermanentDeleteRagId] = useState<string | null>(null);

  useEffect(() => {
    if (!isGlobal) return;
    (async () => {
      const res = await fetch(showTrash ? '/api/admin/rags?include=deleted' : '/api/admin/rags');
      if (res.ok) {
        const data = await res.json();
        setRags(data.rags || []);
      }
    })();
    (async () => {
      if (!showTrash) {
        const res = await fetch('/api/admin/rags?include=deleted');
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.rags) setTrashCount((data.rags as any[]).length);
      }
    })();
  }, [isGlobal, showTrash]);

  if (isLoading) return null;
  if (!isGlobal) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accessDenied')}</CardTitle>
          <CardDescription>{t('globalPermissionsRequired')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  const submitAssign = async () => {
    const res = await fetch('/api/admin/rags/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assign)
    });
    if (res.ok) {
toast.toast({
  title: t('success'),
  description: t('assignmentCreated'),
});
      setAssign({ ...assign, teamSlug: '' });
    } else {
      const e = await res.json().catch(() => ({}));
toast.toast({
  title: t('error'),
  description: t('assignmentError') + (e.error || res.statusText),
  variant: 'destructive',
});
    }
  };

  const confirmDelete = async () => {
    if (!deleteRagId) return;
    const res = await fetch(`/api/rag/packages/${deleteRagId}`, { method: 'DELETE' });
    if (res.ok) {
      setRags((prev) => prev.filter((x) => x.id !== deleteRagId));
toast.toast({
  title: t('success'),
  description: t('ragSentToTrash'),
});
    } else {
toast.toast({
  title: t('error'),
  description: t('deleteFailed'),
  variant: 'destructive',
});
    }
    setDeleteDialogOpen(false);
    setDeleteRagId(null);
  };

  const confirmRestore = async () => {
    if (!restoreRagId) return;
    const res = await fetch(`/api/rag/packages/${restoreRagId}/restore`, { method: 'POST' });
    if (res.ok) {
      setRags((prev) => prev.filter((x) => x.id !== restoreRagId));
toast.toast({
  title: t('success'),
  description: t('ragRestored'),
});
    } else {
toast.toast({
  title: t('error'),
  description: t('restoreFailed'),
  variant: 'destructive',
});
    }
    setRestoreDialogOpen(false);
    setRestoreRagId(null);
  };

  const confirmPermanentDelete = async () => {
    if (!permanentDeleteRagId) return;
    const res = await fetch(`/api/rag/packages/${permanentDeleteRagId}?hard=1`, { method: 'DELETE' });
    if (res.ok) {
      setRags((prev) => prev.filter((x) => x.id !== permanentDeleteRagId));
toast.toast({
  title: t('success'),
  description: t('ragPermanentlyDeleted'),
});
    } else {
toast.toast({
  title: t('error'),
  description: t('permanentDeleteFailed'),
  variant: 'destructive',
});
    }
    setPermanentDeleteDialogOpen(false);
    setPermanentDeleteRagId(null);
  };

  const openDeleteDialog = (ragId: string) => {
    setDeleteRagId(ragId);
    setDeleteDialogOpen(true);
  };

  const openRestoreDialog = (ragId: string) => {
    setRestoreRagId(ragId);
    setRestoreDialogOpen(true);
  };

  const openPermanentDeleteDialog = (ragId: string) => {
    setPermanentDeleteRagId(ragId);
    setPermanentDeleteDialogOpen(true);
  };

  const filteredRags = rags.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.collection_name || '').toLowerCase().includes(q) ||
      (r.team_slug || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('ragsGlobal')}</h1>
          <p className="text-sm text-muted-foreground">{t('listPackagesAssignTeams')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input className="border rounded h-9 px-2" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant={showTrash ? 'default' : 'outline'} onClick={() => setShowTrash((v) => !v)}>
            {showTrash ? t('viewActive') : `${t('trash')}${trashCount !== null ? ` (${trashCount})` : ''}`}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('assignRagToTeam')}</CardTitle>
          <CardDescription>{t('defaultPolicyReadOnly')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>{t('rag')}</Label>
              <select className="w-full border rounded h-9 px-2" value={assign.ragId} onChange={(e) => setAssign(a => ({ ...a, ragId: e.target.value }))}>
                <option value="">{t('selectRag')}</option>
                {rags.map(r => (
                  <option key={r.id} value={r.id}>{r.name} {r.team_slug ? `(team: ${r.team_slug})` : `(scope: ${r.scope || 'team'})`}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('teamSlug')}</Label>
              <Input value={assign.teamSlug} onChange={(e) => setAssign(a => ({ ...a, teamSlug: e.target.value }))} placeholder={t('teamSlugPlaceholder')} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>{t('policy')}</Label>
              <select className="w-full border rounded h-9 px-2" value={assign.policy} onChange={(e) => setAssign(a => ({ ...a, policy: e.target.value }))}>
                <option value="read-only">{t('readOnly')}</option>
                <option value="custom">{t('custom')}</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assign.can_query} onChange={(e) => setAssign(a => ({ ...a, can_query: e.target.checked }))} /> {t('query')}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assign.can_ingest} onChange={(e) => setAssign(a => ({ ...a, can_ingest: e.target.checked }))} /> {t('ingest')}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assign.can_update} onChange={(e) => setAssign(a => ({ ...a, can_update: e.target.checked }))} /> {t('update')}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assign.can_delete} onChange={(e) => setAssign(a => ({ ...a, can_delete: e.target.checked }))} /> {t('delete')}</label>
            </div>
          </div>
          <Button disabled={!assign.ragId || !assign.teamSlug} onClick={submitAssign}>{t('assign')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ragPackages')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredRags.map((r) => (
            <div key={r.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.collection_name}</div>
                <div className="flex gap-2 mt-1">
                  {r.scope && <Badge variant="outline">{r.scope}</Badge>}
                  {r.team_slug && <Badge variant="secondary">{t('team')}: {r.team_slug}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!showTrash ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog(r.id)}
                  >
                    {t('sendToTrash')}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openRestoreDialog(r.id)}>
                      {t('restore')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => openPermanentDeleteDialog(r.id)}>
                      {t('permanentDelete')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredRags.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('noPackagesRegistered')}</div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sendToTrash')}</DialogTitle>
            <DialogDescription>
              {t('sendToTrashDescription', { name: deleteRagId ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('sendToTrash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('restoreRag')}</DialogTitle>
            <DialogDescription>
              {t('restoreRagDescription', { name: restoreRagId ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={confirmRestore}>
              {t('restore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Dialog */}
      <Dialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('permanentDelete')}</DialogTitle>
            <DialogDescription>
              {t('permanentDeleteDescription', { name: permanentDeleteRagId ? permanentDeleteRagId : '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermanentDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmPermanentDelete}>
              {t('deletePermanently')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
