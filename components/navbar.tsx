"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

type NavItem = {
  href: string;
  label: string;
};

function shouldHideOnPath(pathname: string) {
  return pathname !== '/';
}

function isPublicAuthRoute(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  );
}

export default function Navbar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('navigation');

  const user = useUser({ or: 'return-null' });
  const hideNavbar = shouldHideOnPath(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!user) return;
    await user.signOut();
    router.push('/login');
  }, [router, user]);

  const handleMobileSignOut = useCallback(async () => {
    setOpen(false);
    await handleSignOut();
  }, [handleSignOut]);

  if (hideNavbar) return null;

  const isAuthenticated = Boolean(user);
  const isPublicView = !isAuthenticated && isPublicAuthRoute(pathname);

  const navItems: NavItem[] = [
    { href: '/', label: t('home') },
    { href: '/#features', label: t('features') },
    { href: '/#stack', label: t('technology') },
  ];

  const renderNavLinks = (onNavigate?: () => void) =>
    navItems.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className="px-3 py-2 rounded hover:bg-muted"
        onClick={() => {
          onNavigate?.();
        }}
      >
        {item.label}
      </Link>
    ));

  const headerClass = "sticky top-0 z-40 w-full border-b border-border bg-background/50 backdrop-blur-sm";

  return (
    <header className={headerClass}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label="Nexary">
              <Image
                src="/nexary-logo-long.svg"
                alt="Nexary"
                width={160}
                height={40}
                className="h-8 w-auto"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
              {renderNavLinks()}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-2">
              {isAuthenticated ? (
                <Button size="sm" variant="outline" onClick={() => void handleSignOut()}>
                  {t('logout')}
                </Button>
              ) : (
                <>
                  <Link href="/login">
                    <Button size="sm" variant={isPublicView ? 'ghost' : 'outline'}>
                      {t('login')}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">{t('register')}</Button>
                  </Link>
                </>
              )}
            </div>
            <Button
              className="md:hidden"
              size="icon"
              variant="outline"
              onClick={() => setOpen((v) => !v)}
              aria-label={t('menu')}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t bg-background">
          <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col gap-2 text-sm text-muted-foreground">
            {renderNavLinks(() => setOpen(false))}
            <div className="flex flex-col gap-2 pt-2">
              {isAuthenticated ? (
                <Button size="sm" variant="outline" onClick={() => void handleMobileSignOut()}>
                  {t('logout')}
                </Button>
              ) : (
                <>
                  <Link href="/login">
                    <Button
                      size="sm"
                      variant={isPublicView ? 'ghost' : 'outline'}
                      className="w-full"
                      onClick={() => setOpen(false)}
                    >
                      {t('login')}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
                      {t('register')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}



