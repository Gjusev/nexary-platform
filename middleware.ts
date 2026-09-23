import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { stackServerAppForMiddleware } from './lib/stack/stack-server';
import { i18nConfig } from './i18n';
import type { StackUser } from './lib/types/user';

const intlMiddleware = createMiddleware({
  locales: i18nConfig.locales,
  defaultLocale: i18nConfig.defaultLocale,
  localePrefix: i18nConfig.localePrefix,
});

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function matchesBaseRoute(pathname: string, baseRoute: string) {
  if (baseRoute === '/') {
    return pathname === '/' || pathname === '';
  }

  return pathname === baseRoute || pathname.startsWith(`${baseRoute}/`);
}

function normalizeLocale(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return i18nConfig.locales.find((locale) => locale === normalized) ?? null;
}

function getUserPreferredLocale(user: StackUser | null) {
  if (!user) {
    return null;
  }

  return (
    normalizeLocale(user?.serverMetadata?.preferences?.language as string) ??
    normalizeLocale(user?.clientMetadata?.preferences?.language as string)
  );
}

function isLocalizedRequest(pathname: string) {
  if (i18nConfig.localizedRoutes.some((route) => matchesBaseRoute(pathname, route))) {
    return true;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return true;
  }

  const [maybeLocale, ...rest] = segments;
  if (!i18nConfig.locales.includes(maybeLocale as (typeof i18nConfig.locales)[number])) {
    return false;
  }

  if (rest.length === 0) {
    return true;
  }

  const remainder = `/${rest.join('/')}`;
  return i18nConfig.localizedRoutes.some((route) => matchesBaseRoute(remainder, route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname is a locale root (e.g., /de, /es, /en with no trailing segments)
  const segments = pathname.split('/').filter(Boolean);
  const isLocaleRoot = segments.length === 1 && i18nConfig.locales.includes(segments[0] as (typeof i18nConfig.locales)[number]);

  // Handle root path - redirect based on authentication status
  if (pathname === '/' || pathname === '' || isLocaleRoot) {
    // Try to get user to determine redirect
    let user: StackUser | null = null;
    let userPreferredLocale: string | null = null;

    try {
      const rawUser = await stackServerAppForMiddleware.getUser({ or: 'return-null' });
      user = rawUser as unknown as StackUser | null;
      userPreferredLocale = getUserPreferredLocale(user);
    } catch {
      // If error, proceed with null user
    }

    const cookieLocale = normalizeLocale(request.cookies.get('NEXT_LOCALE')?.value);
    const effectiveLocale = userPreferredLocale ?? cookieLocale ?? i18nConfig.defaultLocale;

    const setLocaleCookie = (response: NextResponse) => {
      response.cookies.set('NEXT_LOCALE', effectiveLocale, {
        path: '/',
        maxAge: YEAR_IN_SECONDS,
      });
      return response;
    };

    if (user) {
      // Authenticated user → redirect to chat (next-intl will add locale)
      return setLocaleCookie(NextResponse.redirect(new URL('/chat', request.url)));
    } else {
      // Non-authenticated user → redirect to login (next-intl will add locale)
      return setLocaleCookie(NextResponse.redirect(new URL('/login', request.url)));
    }
  }

  if (isLocalizedRequest(pathname)) {
    return intlMiddleware(request);
  }


  const protectedRoutes = ['/dashboard', '/admin', '/chat'];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // For non-protected routes (landing page), use cookie-based locale only
  const cookieLocale = normalizeLocale(request.cookies.get('NEXT_LOCALE')?.value);

  if (!isProtectedRoute) {
    const effectiveLocale = cookieLocale ?? i18nConfig.defaultLocale;
    const response = NextResponse.next();
    response.cookies.set('NEXT_LOCALE', effectiveLocale, {
      path: '/',
      maxAge: YEAR_IN_SECONDS,
    });
    return response;
  }

  // Only fetch user for protected routes
  let user: StackUser | null = null;
  let userPreferredLocale: string | null = null;

  try {
    const rawUser = await stackServerAppForMiddleware.getUser({ or: 'return-null' });
    // Stack SDK returns CurrentServerUser, we need to cast it to our StackUser type
    user = rawUser as unknown as StackUser | null;
    userPreferredLocale = getUserPreferredLocale(user);
  } catch (error) {
    console.error('Error obteniendo el usuario en middleware:', error);
  }

  const effectiveLocale = userPreferredLocale ?? cookieLocale ?? i18nConfig.defaultLocale;

  const setLocaleCookie = (response: NextResponse) => {
    response.cookies.set('NEXT_LOCALE', effectiveLocale, {
      path: '/',
      maxAge: YEAR_IN_SECONDS,
    });
    return response;
  };

  if (!user) {
    const loginUrl = new URL(`/${effectiveLocale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return setLocaleCookie(NextResponse.redirect(loginUrl));
  }

  // Check if email is verified
  const primaryEmail = user?.primaryEmail;
  const serverEmailVerified = user?.serverMetadata?.emailVerified as boolean | undefined;
  // Also check client-side property (more lenient)
  const clientEmailVerified = (user as any)?.primaryEmailVerified as boolean | undefined;

  // Only redirect if BOTH properties indicate email is not verified
  const isEmailVerified = serverEmailVerified === true || clientEmailVerified === true;

  // If user has email but it's not verified, redirect to verification page
  if (primaryEmail && !isEmailVerified) {
    // Allow access to verification-related routes
    if (!pathname.includes('/verify-email') && !pathname.includes('/handler')) {
      const verifyUrl = new URL(`/${effectiveLocale}/verify-email`, request.url);
      verifyUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return setLocaleCookie(NextResponse.redirect(verifyUrl));
    }
  }

  // Check for 2FA requirement on sensitive routes
  // Strip locale prefix from pathname for route matching
  const pathnameWithoutLocale = i18nConfig.locales.includes(pathname.split('/')[1] as (typeof i18nConfig.locales)[number])
    ? '/' + pathname.split('/').slice(2).join('/')
    : pathname;

  const mfaRequiredRoutes = ['/admin', '/dashboard/admin', '/dashboard/settings/api-keys', '/dashboard/settings/sso', '/dashboard/settings/scim'];
  const isMfaRequiredRoute = mfaRequiredRoutes.some(
    (route) => pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(`${route}/`)
  );

  if (isMfaRequiredRoute) {
    // Check if user has 2FA enabled
    // Stack Auth stores this in user metadata
    const hasMfaEnabled = (user as any)?.hasMfaEnabled === true ||
                         (user?.serverMetadata as any)?.mfaEnabled === true ||
                         (user?.clientMetadata as any)?.mfaEnabled === true;

    if (!hasMfaEnabled) {
      // Redirect to settings page with 2FA requirement message
      // Note: Dashboard routes don't have locale prefix (they're in (authenticated) group)
      const settingsUrl = new URL(`/dashboard/settings/auth`, request.url);
      settingsUrl.searchParams.set('mfaRequired', 'true');
      settingsUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return setLocaleCookie(NextResponse.redirect(settingsUrl));
    }
  }

  const response = setLocaleCookie(NextResponse.next());

  const serverMetadata = user?.serverMetadata || {};
  if (!(serverMetadata as Record<string, unknown>).dbSynced) {
    response.headers.set('X-Needs-Role-Sync', 'true');
  }

  return response;
}

export const config = {
  matcher: [
    // Skip all internal paths (_next) and static files
    '/((?!_next|api|static|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
    // Match auth routes explicitly
    '/(login|register|invite|join)(/.*)?',
  ],
};
