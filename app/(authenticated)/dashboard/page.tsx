"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  Loader2, 
  MessageSquare, 
  FileText, 
  Users, 
  BarChart3,
  Settings,
  Database,
  TrendingUp,
  Clock,
  ArrowRight
} from "lucide-react";
import { useTranslations } from 'next-intl';

import { useTeam } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardStatsCardSkeleton } from "@/components/chat-skeleton";

type TeamStats = {
  documents: { total: number; change: number };
  queries: { today: number; change: number };
  vectors: { total: number; change: number };
  members: { total: number; change: number };
};

function getInitials(name: string, email: string) {
  if (name && name.trim() !== "") {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user, teamSlug, teamName, roles, isOwner } = useTeam();
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const displayName = (user as any)?.displayName ?? (user as any)?.primaryEmail ?? t('user');
  const email = (user as any)?.primaryEmail ?? "ausstehend@konfiguration";
  const initials = useMemo(() => getInitials(displayName, email), [displayName, email]);

  const isTeamLeader = roles.includes("TEAM_LEADER");
  const hasAdminAccess = isOwner || isTeamLeader;

  useEffect(() => {
    if (hasAdminAccess && teamSlug) {
      setLoadingStats(true);
      fetch("/api/team/stats")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStats(data.stats);
          }
        })
        .catch(err => console.error("Error loading stats:", err))
        .finally(() => setLoadingStats(false));
    }
  }, [hasAdminAccess, teamSlug]);

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section>
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">{t('welcomeBack')}</p>
                  <h1 className="text-2xl font-bold text-foreground">
                    {displayName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {teamName ?? teamSlug ?? t('noTeam')}
                    </Badge>
                    {hasAdminAccess && (
                      <Badge variant="outline" className="text-xs">
                        {isOwner ? t('owner') : t('teamLeader')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" size="sm" className="sm:h-10 sm:px-6" asChild>
                  <Link href="/dashboard/settings/profile">
                    <Settings className="w-4 h-4 mr-2" />
                    {t('settings')}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="sm:h-10 sm:px-6" onClick={() => user?.signOut()}>
                  {t('logout')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {loadingStats && (
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-6">
              {t('teamStats')}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardStatsCardSkeleton />
              <DashboardStatsCardSkeleton />
              <DashboardStatsCardSkeleton />
              <DashboardStatsCardSkeleton />
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {t('quickAccess')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/chat">
              <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5 sm:p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-primary/10">
                    <MessageSquare className="w-6 h-6 text-accent-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('startChat')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('startChatDescription')}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/rag">
              <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5 sm:p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-secondary/10">
                    <FileText className="w-6 h-6 text-accent-secondary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('manageRag')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('manageRagDescription')}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/team">
              <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5 sm:p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-success/10">
                    <Users className="w-6 h-6 text-accent-success" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('team')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('teamDescription')}
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/analytics">
              <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5 sm:p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-warning/10">
                    <BarChart3 className="w-6 h-6 text-accent-warning" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('analytics')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('analyticsDescription')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
