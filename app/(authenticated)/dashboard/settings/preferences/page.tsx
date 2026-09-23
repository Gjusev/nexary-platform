'use client';

import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sun, Moon, Monitor, Check, Loader2, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { useUser } from '@stackframe/stack';
import {
  getStoredThemePreference,
  persistThemePreference,
  type ThemePreference,
} from '@/lib/theme-storage';
import { PROVIDERS, getModelsByProvider, type AIProvider } from '@/lib/ai-providers';

type UserPreferences = {
  theme: ThemePreference;
  language: string;
  timezone: string;
  dateFormat: string;
  aiProvider: AIProvider;
  aiModel: string;
};

const languages = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

const timezones = [
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (GMT+1)' },
  { value: 'America/Mexico_City', label: 'America/Mexico_City (GMT-6)' },
  { value: 'America/Bogota', label: 'America/Bogota (GMT-5)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
];

const dateFormats = [
  { value: 'dd-mm-yyyy', label: 'DD.MM.YYYY' },
  { value: 'mm-dd-yyyy', label: 'MM.DD.YYYY' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
];

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'de',
  timezone: 'Europe/Berlin',
  dateFormat: 'dd-mm-yyyy',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
};

export default function PreferencesPage() {
  const user = useUser({ or: 'redirect' });
  const { theme: activeTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const t = useTranslations('preferences');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for each preference
  const [themePreference, setThemePreference] = useState<ThemePreference>(DEFAULT_PREFERENCES.theme);
  const [language, setLanguage] = useState(DEFAULT_PREFERENCES.language);
  const [timezone, setTimezone] = useState(DEFAULT_PREFERENCES.timezone);
  const [dateFormat, setDateFormat] = useState(DEFAULT_PREFERENCES.dateFormat);
  const [aiProvider, setAiProvider] = useState<AIProvider>(DEFAULT_PREFERENCES.aiProvider);
  const [aiModel, setAiModel] = useState(DEFAULT_PREFERENCES.aiModel);

  const [savedPreferences, setSavedPreferences] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });

  const hasChanges =
    themePreference !== savedPreferences.theme ||
    language !== savedPreferences.language ||
    timezone !== savedPreferences.timezone ||
    dateFormat !== savedPreferences.dateFormat ||
    aiProvider !== savedPreferences.aiProvider ||
    aiModel !== savedPreferences.aiModel;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load preferences from clientMetadata
  useEffect(() => {
    if (!mounted || !user) return;

    const clientMeta = user.clientMetadata as Record<string, unknown> | null;
    const storedPrefs = clientMeta?.preferences as Partial<UserPreferences> | undefined;
    const storedTheme = getStoredThemePreference();

    const loaded: UserPreferences = {
      theme: storedTheme || storedPrefs?.theme || DEFAULT_PREFERENCES.theme,
      language: storedPrefs?.language || DEFAULT_PREFERENCES.language,
      timezone: storedPrefs?.timezone || DEFAULT_PREFERENCES.timezone,
      dateFormat: storedPrefs?.dateFormat || DEFAULT_PREFERENCES.dateFormat,
      aiProvider: storedPrefs?.aiProvider || DEFAULT_PREFERENCES.aiProvider,
      aiModel: storedPrefs?.aiModel || DEFAULT_PREFERENCES.aiModel,
    };

    setThemePreference(loaded.theme);
    setLanguage(loaded.language);
    setTimezone(loaded.timezone);
    setDateFormat(loaded.dateFormat);
    setAiProvider(loaded.aiProvider);
    setAiModel(loaded.aiModel);
    setSavedPreferences(loaded);
    setLoading(false);
  }, [mounted, user]);

  // Get available models for selected provider
  const availableModels = getModelsByProvider(aiProvider);

  const handleProviderChange = (newProvider: AIProvider) => {
    setAiProvider(newProvider);
    // Reset to first model of new provider
    const models = getModelsByProvider(newProvider);
    if (models.length > 0) {
      setAiModel(models[0].id);
    }
  };

  const handleSave = useCallback(async () => {
    if (!hasChanges || !user) return;

    const newPreferences: UserPreferences = {
      theme: themePreference,
      language,
      timezone,
      dateFormat,
      aiProvider,
      aiModel,
    };

    try {
      setIsSaving(true);

      // Save to clientMetadata
      const currentMeta = (user.clientMetadata as object) || {};
      const currentPrefs = (currentMeta as any).preferences || {};

      await user.update({
        clientMetadata: {
          ...currentMeta,
          preferences: {
            ...currentPrefs, // Persist other preferences like notifications
            ...newPreferences,
          },
        },
      });

      // Apply theme locally
      if (themePreference !== savedPreferences.theme) {
        persistThemePreference(themePreference);
        setTheme(themePreference);
      }

      setSavedPreferences(newPreferences);

      toast({
        title: t('success.savedTitle'),
        description: t('success.savedDescription'),
      });

      // Reload if language changed
      if (language !== savedPreferences.language) {
        document.cookie = `NEXT_LOCALE=${language}; path=/; max-age=31536000`;
        setTimeout(() => window.location.reload(), 150);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: t('errors.saveFailed'),
        description: t('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, user, themePreference, language, timezone, dateFormat, aiProvider, aiModel, savedPreferences, t, toast, setTheme]);

  const handleResetOnboarding = async () => {
    if (!user) return;
    try {
      // Reset server database record
      await fetch('/api/onboarding/reset', { method: 'DELETE' });

      // Reset client metadata flag
      const currentMeta = (user.clientMetadata as any) || {};
      await user.update({
        clientMetadata: {
          ...currentMeta,
          onboardingCompleted: false
        }
      });

      toast({
        title: "Onboarding Reset",
        description: "Refresh the page to see the wizard again.",
      });

      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast({
        title: "Error",
        description: "Could not reset onboarding.",
        variant: "destructive"
      });
    }
  };

  if (!mounted) return null;

  if (loading) {
    // continue...

    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: Monitor },
  ];

  return (
    <div className="p-6 space-y-8">
      <div className="border-b border-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {t('title')}
          </h2>
          <Button
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loading')}
              </span>
            ) : (
              t('saveButton')
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Theme Selection */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('theme.title')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('theme.description')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = themePreference === option.value;
              return (
                <Card
                  key={option.value}
                  className={`relative cursor-pointer transition-all ${isActive
                    ? 'ring-2 ring-blue-600 dark:ring-blue-500'
                    : 'hover:border-slate-300 dark:hover:border-slate-600'
                    } ${isSaving ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => setThemePreference(option.value)}
                >
                  <div className="p-4 flex flex-col items-center gap-3">
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'
                      }`}>
                      <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                        }`} />
                    </div>
                    <p className={`text-sm font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'
                      }`}>
                      {option.label}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Language Selection */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('language.title')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('language.description')}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {languages.map((lang) => {
              const isActive = language === lang.code;
              return (
                <Card
                  key={lang.code}
                  className={`relative cursor-pointer transition-all ${isActive
                    ? 'ring-2 ring-blue-600 dark:ring-blue-500'
                    : 'hover:border-slate-300 dark:hover:border-slate-600'
                    } ${isSaving ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => setLanguage(lang.code)}
                >
                  <div className="p-4 flex items-center gap-3">
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="text-3xl">{lang.flag}</span>
                    <div>
                      <p className={`text-sm font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                        {lang.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {lang.code.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* AI Settings */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="space-y-1">
            <Label className="text-base font-medium flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t('ai.title') || 'AI Settings'}
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('ai.description') || 'Configure your default AI provider and model.'}
            </p>
          </div>
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t('ai.provider') || 'Provider'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {PROVIDERS[aiProvider]?.name || aiProvider}
                  </p>
                </div>
                <Select value={aiProvider} onValueChange={(v) => handleProviderChange(v as AIProvider)}>
                  <SelectTrigger className="w-[180px]" disabled={isSaving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDERS).map(([id, provider]) => (
                      <SelectItem key={id} value={id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t('ai.model') || 'Model'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {availableModels.find(m => m.id === aiModel)?.name || aiModel}
                    </p>
                  </div>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger className="w-[200px]" disabled={isSaving}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Preferences */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('additional.title')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('additional.description')}
            </p>
          </div>
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t('timezone.title')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {timezones.find((tz) => tz.value === timezone)?.label ?? timezone}
                  </p>
                </div>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-[220px]" disabled={isSaving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t('dateFormat.title')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {dateFormats.find((format) => format.value === dateFormat)?.label ?? dateFormat}
                    </p>
                  </div>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger className="w-[160px]" disabled={isSaving}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Debug / Utilities */}
        <div className="pt-8 border-t border-border">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleResetOnboarding}>
              Reset Onboarding (Debug)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
