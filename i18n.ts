export const i18nConfig = {
  locales: ['en', 'de', 'es'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localizedRoutes: ['/login', '/register'],
} as const;

export type Locale = (typeof i18nConfig)['locales'][number];
