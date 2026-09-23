import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Commissioner, Fira_Code } from 'next/font/google';

import { StackAuthProvider } from '@/components/providers/stack-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import '@/lib/suppress-hydration-warnings';
import { i18nConfig } from '@/i18n';

type Locale = (typeof i18nConfig.locales)[number];

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

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate the locale
  if (!i18nConfig.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${commissioner.variable} ${firaCode.variable} font-sans antialiased`} suppressHydrationWarning>
        <StackAuthProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              storageKey="nexary-theme-preference"
              disableTransitionOnChange
              enableSystem={false}
            >
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
                </div>
              }>
                {children}
              </Suspense>
            </ThemeProvider>
          </NextIntlClientProvider>
        </StackAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}

