'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Monitor, Smartphone, Loader2, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Session {
  id: string;
  user_id: string;
  created_at: number;
  is_impersonation: boolean;
  last_used_at?: number;
  is_current_session?: boolean;
  last_used_at_end_user_ip_info?: {
    ip: string;
    countryCode?: string;
    regionCode?: string;
    cityName?: string;
  };
}

function getDeviceInfo(session: Session) {
  const ipInfo = session.last_used_at_end_user_ip_info;

  if (ipInfo) {
    const location = [ipInfo.cityName, ipInfo.countryCode].filter(Boolean).join(', ');
    return {
      device: 'Device',
      browser: ipInfo.ip || 'Unknown IP',
      location: location || 'Unknown location',
    };
  }

  return {
    device: 'Device',
    browser: 'Unknown',
    location: 'Unknown',
  };
}

function formatDate(dateString?: string) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

export default function SessionsPage() {
  const t = useTranslations('settings.sessions');
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/sessions');
      const data = await response.json();

      if (data.sessions && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        // The first session is typically the current one, or the most recently used
        if (data.sessions.length > 0) {
          // Sort by last_used_at and mark the most recent as current
          const sorted = [...data.sessions].sort((a, b) => {
            const dateA = new Date(a.last_used_at || a.created_at || 0);
            const dateB = new Date(b.last_used_at || b.created_at || 0);
            return dateB.getTime() - dateA.getTime();
          });
          setCurrentSessionId(sorted[0]?.id);
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: t('toast.error'),
        description: t('toast.fetchError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      const response = await fetch(`/api/user/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        toast({
          title: t('toast.revoked'),
          description: t('toast.revokedDescription'),
        });
      } else {
        throw new Error('Failed to revoke session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast({
        title: t('toast.error'),
        description: t('toast.revokeError'),
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t('title')}
        </h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <Label className="text-base font-medium">{t('sectionTitle')}</Label>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('sectionDescription')}
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            {t('noSessions')}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const { device, browser, location } = getDeviceInfo(session);
              const isCurrent = session.is_current_session || session.id === currentSessionId;

              return (
                <div
                  key={session.id}
                  className="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {location || device}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded">
                            {t('currentDeviceBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {browser}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-500">
                        {t('lastActive')}: {formatDate(session.last_used_at ? new Date(session.last_used_at).toISOString() : new Date(session.created_at).toISOString())}
                      </div>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeSession(session.id)}
                      disabled={revokingId === session.id}
                    >
                      {revokingId === session.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t('removeButton')
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
