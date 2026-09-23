'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationPreferences {
  email: boolean;
  team: boolean;
  security: boolean;
  rag: boolean;
}

const defaultPreferences: NotificationPreferences = {
  email: true,
  team: true,
  security: true,
  rag: false,
};

export default function NotificationsPage() {
  const t = useTranslations('settings.notifications');
  const user = useUser({ or: 'redirect' });
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from user metadata
  useEffect(() => {
    if (user?.clientMetadata) {
      const clientMeta = user.clientMetadata as any;
      const savedPrefs = clientMeta?.preferences?.notifications;
      if (savedPrefs) {
        setPreferences({
          email: savedPrefs.email ?? defaultPreferences.email,
          team: savedPrefs.team ?? defaultPreferences.team,
          security: savedPrefs.security ?? defaultPreferences.security,
          rag: savedPrefs.rag ?? defaultPreferences.rag,
        });
      }
    }
    setIsLoading(false);
  }, [user?.clientMetadata]);

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    const newNotifications = { ...preferences, [key]: value };
    setPreferences(newNotifications);

    try {
      setIsSaving(true);
      const currentMeta = (user.clientMetadata as any) || {};
      const currentPrefs = currentMeta.preferences || {};

      await user.update({
        clientMetadata: {
          ...currentMeta,
          preferences: {
            ...currentPrefs, // Persist other settings (theme, language, etc)
            notifications: newNotifications,
          },
        },
      });
      toast({
        title: t('toast.saved'),
        description: t('toast.savedDescription'),
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Revert on error
      setPreferences(preferences);
      toast({
        title: t('toast.error'),
        description: t('toast.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const notificationItems = [
    {
      id: 'email' as const,
      label: t('toggles.email.label'),
      description: t('toggles.email.description'),
    },
    {
      id: 'team' as const,
      label: t('toggles.team.label'),
      description: t('toggles.team.description'),
    },
    {
      id: 'security' as const,
      label: t('toggles.security.label'),
      description: t('toggles.security.description'),
    },
    {
      id: 'rag' as const,
      label: t('toggles.rag.label'),
      description: t('toggles.rag.description'),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
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
        <div className="space-y-4">
          <Label className="text-base font-medium">{t('sectionTitle')}</Label>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('sectionDescription')}
          </p>
        </div>

        <div className="space-y-4">
          {notificationItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between py-3 ${index === 0 ? '' : 'border-t border-slate-200 dark:border-slate-800'
                }`}
            >
              <div className="space-y-1">
                <Label htmlFor={`${item.id}-notifications`} className="text-base">
                  {item.label}
                </Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
              <Switch
                id={`${item.id}-notifications`}
                checked={preferences[item.id]}
                onCheckedChange={(checked) => handleToggle(item.id, checked)}
                disabled={isSaving}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
