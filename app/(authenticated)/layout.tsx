import '../globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Commissioner, Fira_Code } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { StackAuthProvider } from '@/components/providers/stack-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { PreferencesSync } from '@/components/preferences-sync';
import { Toaster } from '@/components/ui/toaster';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { OnboardingCheck } from '@/components/onboarding/onboarding-check';
import { stackServerApp } from '@/lib/stack/stack-server';
import { ensureUserHasTeam } from '@/lib/stack/post-login';
import '@/lib/suppress-hydration-warnings';
import { resolveLocale } from '@/lib/i18n/resolve-locale';

const commissioner = Commissioner({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nexary - DSGVO-konforme KI-Plattform für Unternehmen',
  description:
    'KI-Innovation ohne Datenschutzrisiko. Nexary bietet Multi-Provider KI mit RAG, 100% DSGVO-konform, hosted in Deutschland.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/nexary-logo.webp', type: 'image/webp' },
    ],
    shortcut: '/favicon.svg',
    apple: '/nexary-logo.webp',
  },
};


export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure user has a team (fixes Google SSO issue)
  try {
    const user = await stackServerApp.getUser();
    if (user) {
      await ensureUserHasTeam(user);
    }
  } catch (e) {
    console.error('Failed to ensure user team:', e);
  }

  const locale = await resolveLocale();
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  const fallback = (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100" />
    </div>
  );

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${commissioner.variable} ${firaCode.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <StackAuthProvider>
          <Suspense fallback={fallback}>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                storageKey="nexary-theme-preference"
                disableTransitionOnChange={false}
                enableSystem={false}
              >
                <OnboardingProvider>
                  <PreferencesSync />
                  <OnboardingCheck />
                  <Suspense fallback={fallback}>{children}</Suspense>
                </OnboardingProvider>
              </ThemeProvider>
            </NextIntlClientProvider>
          </Suspense>
        </StackAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
