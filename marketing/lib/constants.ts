/**
 * External URLs and constants used throughout the application
 */

const NEXUS_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://app.nexary.example.com"

export const EXTERNAL_URLS = {
    /**
     * Nexus platform URLs — set NEXT_PUBLIC_APP_URL to your deployment
     */
    nexus: {
        baseUrl: NEXUS_BASE,
        login: `${NEXUS_BASE}/login`,
        register: `${NEXUS_BASE}/register`,
    },
} as const

/**
 * Type-safe external URL keys
 */
export type ExternalUrlKey = keyof typeof EXTERNAL_URLS.nexus

/**
 * Get an external URL by key
 */
export function getExternalUrl(key: ExternalUrlKey): string {
    return EXTERNAL_URLS.nexus[key]
}

/**
 * Site configuration constants
 */
export const SITE_CONFIG = {
    name: "Nexary",
    description: "Nexary – The Secure AI Platform for Enterprises",
    url: "https://nexary.de",
    ogImage: "/og-image.png",
    links: {
        github: "https://github.com/nexary",
        twitter: "https://twitter.com/nexary",
        linkedin: "https://linkedin.com/company/nexary",
    },
} as const
