import type { ReactNode } from "react";
import "./globals.css";
import { Commissioner, Fira_Code } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

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

export default function RootLayout({ children }: { children: ReactNode }) {
  // In next-intl setup, the LocaleLayout handles the html tag with lang
  // This root layout just provides the body structure
  return <>{children}</>;
}
