'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useTeam } from '@/hooks/use-team';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function AdminContent() {
  const t = useTranslations('admin');
  const { roles, isLoading } = useTeam();
  const isGlobal = roles.includes('global-admin') || roles.includes('global-rag-admin');

  if (isLoading) return null;
  if (!isGlobal) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('accessDenied')}</CardTitle>
            <CardDescription>{t('globalPermissionsRequired')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline">{t('backToDashboard')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('adminPanel')}</h1>
        <p className="text-sm text-muted-foreground">{t('manageGlobalRagsTeamsRoles')}</p>
        <div className="mt-2 flex gap-2">
          {roles.map((r) => (
            <Badge key={r} variant="outline">{r}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/billing">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('billing')}</CardTitle>
              <CardDescription>{t('changePlanManageAddons')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/plans">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('plans')}</CardTitle>
              <CardDescription>{t('createEditPlans')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/analytics">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('analytics')}</CardTitle>
              <CardDescription>{t('usageByTeamsLimits')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/rags">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('rags')}</CardTitle>
              <CardDescription>{t('listRagsAssignTeams')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/rags/users">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('userAccess')}</CardTitle>
              <CardDescription>{t('permissionsPerUserForRags')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/teams">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('teams')}</CardTitle>
              <CardDescription>{t('listTeamsPlans')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('globalRoles')}</CardTitle>
              <CardDescription>{t('assignPlatformRoles')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={<div className="p-6">{t('loading')}</div>}>
      <AdminContent />
    </Suspense>
  );
}
