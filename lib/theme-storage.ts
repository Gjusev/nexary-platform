'use client';

/**
 * Centraliza la gestión de la preferencia de tema del usuario en localStorage.
 * Mantiene la clave consistente entre componentes y evita guardar "system"
 * para permitir que el modo del sistema opere solo cuando el usuario lo elige.
 */
export const THEME_STORAGE_KEY = 'nexary-theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';

export function getStoredThemePreference(): ThemePreference | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return (window.localStorage.getItem(THEME_STORAGE_KEY) ?? null) as ThemePreference | null;
}

export function persistThemePreference(theme: ThemePreference | null | undefined) {
  if (typeof window === 'undefined' || !theme) {
    return;
  }

  if (theme === 'system') {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
