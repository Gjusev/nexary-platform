import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { SkipLink } from '@/components/skip-link'
import { Toaster } from '@/components/ui/toaster'
import '../globals.css'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

type Props = {
    children: React.ReactNode
    params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: 'meta' })

    return {
        title: {
            default: t('title'),
            template: `%s | Nexary`,
        },
        description: t('description'),
        keywords: t('keywords'),
        authors: [{ name: 'Nexary' }],
        creator: 'Nexary',
        openGraph: {
            type: 'website',
            locale: locale === 'de' ? 'de_DE' : locale === 'es' ? 'es_ES' : 'en_US',
            url: 'https://nexary.de',
            siteName: 'Nexary',
            title: t('title'),
            description: t('description'),
        },
        twitter: {
            card: 'summary_large_image',
            title: t('title'),
            description: t('description'),
        },
        robots: {
            index: true,
            follow: true,
        },
    }
}

export default async function LocaleLayout({ children, params }: Props) {
    const { locale } = await params
    const messages = await getMessages()

    return (
        <html lang={locale} suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <NextIntlClientProvider messages={messages}>
                        <SkipLink />
                        <div className="relative min-h-screen flex flex-col">
                            <Navbar />
                            <main id="main-content" className="flex-1">
                                {children}
                            </main>
                            <Footer />
                        </div>
                        <Toaster />
                    </NextIntlClientProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
