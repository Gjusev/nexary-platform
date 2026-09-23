import { cookies } from 'next/headers';

import { i18nConfig, type Locale } from '@/i18n';
import { stackServerApp } from '@/lib/stack/stack-server';

type MaybeLocale = string | null | undefined;

function normalizeLocale(value: MaybeLocale): Locale | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return i18nConfig.locales.find((locale) => locale === normalized) ?? null;
}

export async function resolveLocale(): Promise<Locale> {
  const user = await stackServerApp.getUser({ or: 'return-null' });

  const userPreferredLocale = normalizeLocale(
    ((user as any)?.serverMetadata?.preferences?.language as MaybeLocale) ??
      ((user as any)?.preferences?.language as MaybeLocale)
  );

  const cookieStore = await cookies();
  const cookieLocale = normalizeLocale(cookieStore.get('NEXT_LOCALE')?.value);

  if (userPreferredLocale ?? cookieLocale) {
    return (userPreferredLocale ?? cookieLocale) as Locale;
  }

  // Fallback to Accept-Language header
  const headersList = await import('next/headers').then(mod => mod.headers());
  const acceptLanguage = headersList.get('accept-language');
  
  if (acceptLanguage) {
    const preferredLocales = acceptLanguage.split(',').map(lang => lang.split(';')[0].trim().toLowerCase());
    for (const lang of preferredLocales) {
      const matched = normalizeLocale(lang);
      if (matched) return matched;
    }
  }

  return i18nConfig.defaultLocale;
}
