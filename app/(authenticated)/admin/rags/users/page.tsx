"use client";

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Rag = { id: string; name: string };
type Assignment = { id: string; rag_id: string; team_slug: string; user_id: string; can_query: boolean; can_ingest: boolean; can_update: boolean; can_delete: boolean; created_at: string };

export default function RagUserAccessPage() {
  const t = useTranslations('admin.rags.users');
  const { roles, isLoading } = useTeam();
  const isGlobal = roles.some((r: string) => r === 'global-admin' || r === 'global-rag-admin');
  const [rags, setRags] = useState<Rag[]>([]);
  const [form, setForm] = useState({ ragId: '', teamSlug: '', userId: '', can_query: true, can_ingest: false, can_update: false, can_delete: false });
  const [list, setList] = useState<Assignment[]>([]);

  useEffect(() => {
    if (!isGlobal) return;
    (async () => {
      const res = await fetch('/api/admin/rags');
      if (res.ok) {
        const data = await res.json();
        setRags((data.rags || []).map((r: any) => ({ id: r.id, name: r.name })));
      }
    })();
  }, [isGlobal]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (form.teamSlug) params.set('teamSlug', form.teamSlug);
    if (form.ragId) params.set('ragId', form.ragId);
    const res = await fetch(`/api/admin/rags/user-assign?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setList(data.assignments || []);
    }
  }, [form.teamSlug, form.ragId]);

  useEffect(() => { if (isGlobal) load(); }, [isGlobal, load]);

  if (status === 'loading') return null;
  if (!isGlobal) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accessDenied')}</CardTitle>
          <CardDescription>{t('requiresGlobalRole')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  const submit = async () => {
    const res = await fetch('/api/admin/rags/user-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      await load();
      setForm({ ...form, userId: '' });
    } else {
      const err = await res.json().catch(() => ({}));
      alert(t('error') + ': ' + (err.error || res.statusText));
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('userAccessToRags')}</h1>
        <p className="text-sm text-muted-foreground">{t('grantPermissionsPerUserForSpecificRag')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('grantAccess')}</CardTitle>
          <CardDescription>{t('selectRagTeamAndUser')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>{t('rag')}</Label>
              <select className="w-full border rounded h-9 px-2" value={form.ragId} onChange={(e) => setForm((f) => ({ ...f, ragId: e.target.value }))}>
                <option value="">{t('select')}</option>
                {rags.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('teamSlug')}</Label>
              <Input value={form.teamSlug} onChange={(e) => setForm((f) => ({ ...f, teamSlug: e.target.value }))} placeholder={t('myTeam')} />
            </div>
            <div>
              <Label>{t('userIdStack')}</Label>
              <Input value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} placeholder={t('stackUserId')} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.can_query} onChange={(e) => setForm((f)=>({ ...f, can_query: e.target.checked }))}/> {t('query')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.can_ingest} onChange={(e) => setForm((f)=>({ ...f, can_ingest: e.target.checked }))}/> {t('ingest')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.can_update} onChange={(e) => setForm((f)=>({ ...f, can_update: e.target.checked }))}/> {t('update')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.can_delete} onChange={(e) => setForm((f)=>({ ...f, can_delete: e.target.checked }))}/> {t('delete')}</label>
          </div>
          <div className="flex gap-2">
            <Button disabled={!form.ragId || !form.teamSlug || !form.userId} onClick={submit}>{t('save')}</Button>
            <Button variant="outline" onClick={load}>{t('refreshList')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('assignments')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {list.map((a) => (
            <div key={a.id} className="border rounded p-3">
              <div><span className="font-mono">{a.user_id}</span> · rag <span className="font-mono">{a.rag_id}</span> · team {a.team_slug}</div>
              <div className="text-xs text-muted-foreground">{t('query')}: {String(a.can_query)} {t('ingest')}: {String(a.can_ingest)} {t('update')}: {String(a.can_update)} {t('delete')}: {String(a.can_delete)} · {new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
          {list.length === 0 && <div className="text-muted-foreground">{t('noAssignments')}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
