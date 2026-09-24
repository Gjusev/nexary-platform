"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Linkedin, Twitter } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function Footer() {
    const t = useTranslations("footer")
    const locale = useLocale()
    const currentYear = new Date().getFullYear()

    const productLinks = [
        { name: t("platform"), href: `/${locale}/platform` },
        { name: t("features"), href: `/${locale}/platform#features` },
        { name: t("integrations"), href: `/${locale}/platform#integrations` },
        { name: t("security"), href: `/${locale}/platform#security` },
    ]

    const companyLinks = [
        { name: t("aboutUs"), href: `/${locale}/about` },
        { name: t("contact"), href: `/${locale}/contact` },
        { name: t("useCases"), href: `/${locale}/use-cases` },
    ]

    const resourceLinks = [
        { name: t("privacy"), href: `/${locale}/legal/datenschutz` },
        { name: t("agb"), href: `/${locale}/legal/agb` },
        { name: t("impressum"), href: `/${locale}/legal/impressum` },
    ]

    return (
        <footer className="w-full border-t bg-muted/30">
            <div className="container py-12 md:py-16">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
                    {/* Brand Column */}
                    <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
                        <Link href={`/${locale}`} className="flex items-center gap-2">
                            <img
                                src="/nexary-logo-long.svg"
                                alt="Nexary"
                                className="h-7 w-auto dark:invert"
                            />
                        </Link>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            {t("slogan")}
                        </p>
                        <div className="flex gap-3 mt-2">
                            <a
                                href="https://linkedin.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                                aria-label="LinkedIn"
                            >
                                <Linkedin className="h-5 w-5" />
                            </a>
                            <a
                                href="https://twitter.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                                aria-label="Twitter"
                            >
                                <Twitter className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    {/* Product Column */}
                    <div className="flex flex-col gap-3">
                        <h3 className="font-semibold text-foreground">{t("product")}</h3>
                        <nav className="flex flex-col gap-2">
                            {productLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Company Column */}
                    <div className="flex flex-col gap-3">
                        <h3 className="font-semibold text-foreground">{t("company")}</h3>
                        <nav className="flex flex-col gap-2">
                            {companyLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Resources Column */}
                    <div className="flex flex-col gap-3">
                        <h3 className="font-semibold text-foreground">{t("resources")}</h3>
                        <nav className="flex flex-col gap-2">
                            {resourceLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                <Separator className="my-8" />

                {/* Bottom Section */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        {t("copyright", { year: currentYear })}
                    </p>
                    <div className="flex gap-6">
                        <Link
                            href={`/${locale}/legal/datenschutz`}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {t("privacy")}
                        </Link>
                        <Link
                            href={`/${locale}/legal/agb`}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {t("agb")}
                        </Link>
                        <Link
                            href={`/${locale}/legal/impressum`}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {t("impressum")}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
