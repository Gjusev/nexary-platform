'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useUser } from '@stackframe/stack';
import { useLocale } from 'next-intl';
import {
  getStoredThemePreference,
  persistThemePreference,
  type ThemePreference,
} from '@/lib/theme-storage';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function PreferencesSync() {
  const user = useUser({ or: 'return-null' });
  const { setTheme, theme: currentTheme } = useTheme();
  const locale = useLocale();

  useEffect(() => {
    if (!user) return;

    const clientMeta = user.clientMetadata as any;
    const preferences = clientMeta?.preferences;

    if (!preferences) return;

    // Sync Theme
    if (preferences.theme) {
      const userTheme = preferences.theme as ThemePreference;
      // Only apply if different and generic 'system' isn't just default
      if (userTheme !== currentTheme) {
        // Verify if it's a valid theme preference
        if (['light', 'dark', 'system'].includes(userTheme)) {
          setTheme(userTheme);
          persistThemePreference(userTheme);
        }
      }
    }

    // Sync Language - only reload if cookie doesn't match preferred language
    if (preferences.language && preferences.language !== locale) {
      const currentCookie = getCookie('NEXT_LOCALE');

      // Only reload if the cookie is not already set to the preferred language
      if (currentCookie !== preferences.language) {
        // Set cookie BEFORE reload to ensure middleware sees the correct value
        document.cookie = `NEXT_LOCALE=${preferences.language}; path=/; max-age=31536000`;


        // Small delay to ensure cookie is set before reload
        setTimeout(() => {
          console.warn('⚠️ [Preferences Sync] Reload disabled to prevent loop. Please refresh manually if language is incorrect.');
          // window.location.reload();
        }, 100);
      } else {
        }
    }

  }, [user, setTheme, currentTheme, locale]);

  return null;
}
