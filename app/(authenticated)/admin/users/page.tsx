'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useTeam } from '@/hooks/use-team';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type User = { id: string; email: string; name?: string; roles: string[] };

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const toast = useToast();
  const { roles, isLoading, status } = useTeam();
  const isGlobal = roles.some((r: string) => r === 'global-admin');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    if (!isGlobal) return;
    (async () => {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    })();
  }, [isGlobal]);

  const assignRole = async (userId: string, role: string) => {
    const res = await fetch('/api/admin/users/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role })
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: [...u.roles, role] } : u));
      toast.toast({
        title: t('success'),
        description: t('roleAssigned'),
      });
    } else {
      toast.toast({
        title: t('error'),
        description: t('roleAssignmentFailed'),
        variant: 'destructive',
      });
    }
  };

  if (isLoading || status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isGlobal) return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accessDenied')}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('globalRoles')}</h1>
        <p className="text-sm text-muted-foreground">{t('assignPlatformRoles')}</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>{t('userId')}</Label>
              <Input placeholder={t('userIdPlaceholder')} onChange={(e) => setSelectedUser(users.find(u => u.id === e.target.value) || null)} list="users-list" />
              <datalist id="users-list">
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </datalist>
            </div>
            <div>
              <Label>{t('role')}</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global-admin">{t('globalAdmin')}</SelectItem>
                  <SelectItem value="global-rag-admin">{t('globalRagAdmin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => {
            if (selectedUser && newRole) {
              assignRole(selectedUser.id, newRole);
              setNewRole('');
              setSelectedUser(null);
            }
          }} disabled={!selectedUser || !newRole}>{t('assignRole')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {users.map(u => (
            <div key={u.id} className="border rounded p-3">
              <div className="font-medium">{u.name || u.email}</div>
              <div className="text-sm text-muted-foreground">{u.id}</div>
              <div className="flex gap-2 mt-2">
                {u.roles.map(r => (
                  <Badge key={r} variant="outline">{r}</Badge>
                ))}
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="text-sm text-muted-foreground">{t('noUsers')}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
