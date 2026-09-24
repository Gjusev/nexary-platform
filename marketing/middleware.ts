import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { locales, defaultLocale } from './lib/i18n'

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
})

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
