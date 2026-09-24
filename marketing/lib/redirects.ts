const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.nexary.example.com'

export function getAppUrl(locale: string, path: 'login' | 'register') {
  return `${APP_URL}/${locale}/${path}`
}
