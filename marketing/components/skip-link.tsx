"use client"

import { useTranslations } from "next-intl"

/**
 * Skip to main content link for accessibility
 *
 * This link is hidden by default and becomes visible when it receives focus,
 * allowing keyboard users to skip navigation and go directly to the main content.
 *
 * WCAG 2.1 Level A requirement: 2.4.1 Bypass Blocks
 */
export function SkipLink() {
    const t = useTranslations("accessibility")

    return (
        <a
            href="#main-content"
            className="skip-to-main"
            aria-label={t("skipToMain")}
        >
            {t("skipToMain")}
        </a>
    )
}
