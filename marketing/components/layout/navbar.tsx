"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Menu, Globe, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { EXTERNAL_URLS } from "@/lib/constants"

const languages = [
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "es", label: "Español", flag: "🇪🇸" },
]

export function Navbar() {
    const t = useTranslations("nav")
    const locale = useLocale()
    const pathname = usePathname()
    const router = useRouter()
    const [isOpen, setIsOpen] = React.useState(false)

    const navItems = [
        { name: t("platform"), href: `/${locale}/platform` },
        { name: t("useCases"), href: `/${locale}/use-cases` },
        { name: t("pricing"), href: `/${locale}/#pricing` },
        { name: t("about"), href: `/${locale}/about` },
        { name: t("contact"), href: `/${locale}/contact` },
    ]

    const switchLocale = (newLocale: string) => {
        const segments = pathname.split("/")
        segments[1] = newLocale
        router.push(segments.join("/"))
    }

    const currentLang = languages.find((l) => l.code === locale) || languages[0]

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                {/* Logo */}
                <Link href={`/${locale}`} className="flex items-center gap-2">
                    <img
                        src="/nexary-logo-long.svg"
                        alt="Nexary"
                        className="h-7 w-auto dark:invert"
                    />
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                pathname === item.href
                                    ? "text-foreground bg-accent"
                                    : "text-muted-foreground"
                            )}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    {/* Theme Toggle */}
                    <ThemeToggle />

                    {/* Language Selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2" aria-label="Select language">
                                <Globe className="h-4 w-4" />
                                <span className="hidden sm:inline">{currentLang.flag}</span>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {languages.map((lang) => (
                                <DropdownMenuItem
                                    key={lang.code}
                                    onClick={() => switchLocale(lang.code)}
                                    className={cn(
                                        "gap-2",
                                        locale === lang.code && "bg-accent"
                                    )}
                                >
                                    <span>{lang.flag}</span>
                                    <span>{lang.label}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Login Button */}
                    <Link href={EXTERNAL_URLS.nexus.login} rel="noopener noreferrer" target="_blank" className="hidden sm:block">
                        <Button variant="ghost" size="sm">
                            {t("login")}
                        </Button>
                    </Link>

                    {/* Register Button */}
                    <Link href={EXTERNAL_URLS.nexus.register} rel="noopener noreferrer" target="_blank" className="hidden sm:block">
                        <Button size="sm" className="font-medium">
                            {t("register")}
                        </Button>
                    </Link>

                    {/* Mobile Menu */}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild className="md:hidden">
                            <Button variant="ghost" size="icon" aria-label="Toggle navigation menu">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                            <SheetHeader>
                                <SheetTitle className="text-left">{t("useCases") || "Navigation"}</SheetTitle>
                            </SheetHeader>
                            <nav className="flex flex-col gap-4 mt-8">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            "px-4 py-3 rounded-lg text-lg font-medium transition-colors hover:bg-accent",
                                            pathname === item.href
                                                ? "text-foreground bg-accent"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                                <div className="border-t pt-4 mt-4 flex flex-col gap-3">
                                    <Link href={EXTERNAL_URLS.nexus.login} rel="noopener noreferrer" target="_blank" onClick={() => setIsOpen(false)}>
                                        <Button variant="outline" className="w-full">
                                            {t("login")}
                                        </Button>
                                    </Link>
                                    <Link href={EXTERNAL_URLS.nexus.register} rel="noopener noreferrer" target="_blank" onClick={() => setIsOpen(false)}>
                                        <Button className="w-full">
                                            {t("register")}
                                        </Button>
                                    </Link>
                                </div>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div >
        </header >
    )
}
