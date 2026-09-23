import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Commissioner, Fira_Code } from 'next/font/google';
import { StackAuthProvider } from '@/components/providers/stack-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import '@/lib/suppress-hydration-warnings';

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

export const metadata: Metadata = {
  title: 'Login - Nexary',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/nexary-logo.webp', type: 'image/webp' },
    ],
    shortcut: '/favicon.svg',
    apple: '/nexary-logo.webp',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${commissioner.variable} ${firaCode.variable} font-sans antialiased`} suppressHydrationWarning>
        <StackAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="nexary-theme-preference"
            disableTransitionOnChange
          >
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            }>
              {children}
            </Suspense>
          </ThemeProvider>
        </StackAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
