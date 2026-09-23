"use client";

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { i18nConfig } from '@/i18n';
import type { Locale } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useUser } from '@stackframe/stack';

const localeOptions = [...i18nConfig.locales] as Locale[];
const localeSet = new Set<Locale>(localeOptions);

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const languageLabels = t.raw('languages') as Record<string, string>;

  const user = useUser({ or: 'return-null' });

  const handleChange = async (value: Locale) => {
    if (value === locale) {
      return;
    }

    // Set cookie immediately to prevent PreferencesSync mismatch
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=31536000`;

    const segments = pathname.split('/').filter(Boolean);

    if (segments.length > 0 && localeSet.has(segments[0] as Locale)) {
      segments[0] = value;
    } else {
      segments.unshift(value);
    }

    const nextPath = `/${segments.join('/')}`;

    startTransition(() => {
      router.push(nextPath);
    });

    // Update user preference in background (non-blocking)
    if (user) {
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: value }),
      }).catch((error) => {
        console.error('Error updating language preference:', error);
      });
    }
  };

  return (
    <Select value={locale} onValueChange={(next) => handleChange(next as Locale)} disabled={isPending}>
      <SelectTrigger className={`flex items-center ${className}`} aria-label={t('language')}>
        <SelectValue placeholder={t('language')} />
      </SelectTrigger>
      <SelectContent>
        {localeOptions.map((value) => (
          <SelectItem key={value} value={value}>
            {languageLabels[value] ?? value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
