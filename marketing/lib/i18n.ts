import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

export const locales = ['de', 'en', 'es'] as const
export const defaultLocale = 'de'
type Locale = (typeof locales)[number]

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  
  if (!locale) {
    locale = defaultLocale
  }
  
  if (!locales.includes(locale as Locale)) notFound()

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  }
})
