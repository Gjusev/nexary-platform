"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Users,
    Monitor,
    Headphones,
    TrendingUp,
    Megaphone,
    Calculator,
    Scale,
    Lightbulb,
    Settings,
    Mail,
    FileText,
    Globe,
    Code,
    BarChart,
    MessageSquare,
    Search,
    Zap,
    CheckCircle,
    ArrowRight,
} from "lucide-react"

// Map category IDs to their icons
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    allgemein: Zap,
    marketing: Megaphone,
    hr: Users,
    finanzen: Calculator,
    operations: Settings,
    software: Code,
    management: Lightbulb,
    legal: Scale,
}

// Map use case item keys to their icons
const itemIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    emails: Mail,
    correct: FileText,
    tables: BarChart,
    meetings: MessageSquare,
    research: Globe,
    translations: FileText,
    content: FileText,
    seo: Search,
    campaigns: Lightbulb,
    outreach: Mail,
    ads: MessageSquare,
    leads: TrendingUp,
    jobAds: FileText,
    resumes: Search,
    interviews: MessageSquare,
    references: FileText,
    onboarding: CheckCircle,
    reporting: BarChart,
    summary: FileText,
    budget: Calculator,
    bigdata: BarChart,
    excel: Calculator,
    intranet: MessageSquare,
    support: Headphones,
    helpdesk: Monitor,
    accounting: Calculator,
    code: Code,
    bugs: Search,
    review: CheckCircle,
    docs: FileText,
    strategy: BarChart,
    competition: Search,
    vision: Lightbulb,
    contracts: FileText,
    clauses: Search,
    compliance: CheckCircle,
    diligence: FileText,
}

export default function UseCasesPage() {
    const t = useTranslations("useCases")
    const tp = useTranslations("useCasesPage")
    const locale = useLocale()
    const [activeCategory, setActiveCategory] = useState("allgemein")

    // Build categories from translations
    const categories = [
        {
            id: "allgemein",
            title: tp("categories.allgemein.title"),
            icon: categoryIcons.allgemein,
            color: "text-gray-500",
            bgColor: "bg-gray-500/10",
            useCases: [
                { title: tp("categories.allgemein.items.emails"), desc: tp("categories.allgemein.items.emailsDesc"), icon: itemIcons.emails },
                { title: tp("categories.allgemein.items.correct"), desc: tp("categories.allgemein.items.correctDesc"), icon: itemIcons.correct },
                { title: tp("categories.allgemein.items.tables"), desc: tp("categories.allgemein.items.tablesDesc"), icon: itemIcons.tables },
                { title: tp("categories.allgemein.items.meetings"), desc: tp("categories.allgemein.items.meetingsDesc"), icon: itemIcons.meetings },
                { title: tp("categories.allgemein.items.research"), desc: tp("categories.allgemein.items.researchDesc"), icon: itemIcons.research },
                { title: tp("categories.allgemein.items.translations"), desc: tp("categories.allgemein.items.translationsDesc"), icon: itemIcons.translations },
            ]
        },
        {
            id: "marketing",
            title: tp("categories.marketing.title"),
            icon: categoryIcons.marketing,
            color: "text-pink-500",
            bgColor: "bg-pink-500/10",
            useCases: [
                { title: tp("categories.marketing.items.content"), desc: tp("categories.marketing.items.contentDesc"), icon: itemIcons.content },
                { title: tp("categories.marketing.items.seo"), desc: tp("categories.marketing.items.seoDesc"), icon: itemIcons.seo },
                { title: tp("categories.marketing.items.campaigns"), desc: tp("categories.marketing.items.campaignsDesc"), icon: itemIcons.campaigns },
                { title: tp("categories.marketing.items.outreach"), desc: tp("categories.marketing.items.outreachDesc"), icon: itemIcons.outreach },
                { title: tp("categories.marketing.items.ads"), desc: tp("categories.marketing.items.adsDesc"), icon: itemIcons.ads },
                { title: tp("categories.marketing.items.leads"), desc: tp("categories.marketing.items.leadsDesc"), icon: itemIcons.leads },
            ]
        },
        {
            id: "hr",
            title: tp("categories.hr.title"),
            icon: categoryIcons.hr,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            useCases: [
                { title: tp("categories.hr.items.jobAds"), desc: tp("categories.hr.items.jobAdsDesc"), icon: itemIcons.jobAds },
                { title: tp("categories.hr.items.resumes"), desc: tp("categories.hr.items.resumesDesc"), icon: itemIcons.resumes },
                { title: tp("categories.hr.items.interviews"), desc: tp("categories.hr.items.interviewsDesc"), icon: itemIcons.interviews },
                { title: tp("categories.hr.items.references"), desc: tp("categories.hr.items.referencesDesc"), icon: itemIcons.references },
                { title: tp("categories.hr.items.onboarding"), desc: tp("categories.hr.items.onboardingDesc"), icon: itemIcons.onboarding },
            ]
        },
        {
            id: "finanzen",
            title: tp("categories.finanzen.title"),
            icon: categoryIcons.finanzen,
            color: "text-cyan-500",
            bgColor: "bg-cyan-500/10",
            useCases: [
                { title: tp("categories.finanzen.items.reporting"), desc: tp("categories.finanzen.items.reportingDesc"), icon: itemIcons.reporting },
                { title: tp("categories.finanzen.items.summary"), desc: tp("categories.finanzen.items.summaryDesc"), icon: itemIcons.summary },
                { title: tp("categories.finanzen.items.budget"), desc: tp("categories.finanzen.items.budgetDesc"), icon: itemIcons.budget },
                { title: tp("categories.finanzen.items.bigdata"), desc: tp("categories.finanzen.items.bigdataDesc"), icon: itemIcons.bigdata },
                { title: tp("categories.finanzen.items.excel"), desc: tp("categories.finanzen.items.excelDesc"), icon: itemIcons.excel },
            ]
        },
        {
            id: "operations",
            title: tp("categories.operations.title"),
            icon: categoryIcons.operations,
            color: "text-orange-500",
            bgColor: "bg-orange-500/10",
            useCases: [
                { title: tp("categories.operations.items.intranet"), desc: tp("categories.operations.items.intranetDesc"), icon: itemIcons.intranet },
                { title: tp("categories.operations.items.support"), desc: tp("categories.operations.items.supportDesc"), icon: itemIcons.support },
                { title: tp("categories.operations.items.helpdesk"), desc: tp("categories.operations.items.helpdeskDesc"), icon: itemIcons.helpdesk },
                { title: tp("categories.operations.items.accounting"), desc: tp("categories.operations.items.accountingDesc"), icon: itemIcons.accounting },
            ]
        },
        {
            id: "software",
            title: tp("categories.software.title"),
            icon: categoryIcons.software,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
            useCases: [
                { title: tp("categories.software.items.code"), desc: tp("categories.software.items.codeDesc"), icon: itemIcons.code },
                { title: tp("categories.software.items.bugs"), desc: tp("categories.software.items.bugsDesc"), icon: itemIcons.bugs },
                { title: tp("categories.software.items.review"), desc: tp("categories.software.items.reviewDesc"), icon: itemIcons.review },
                { title: tp("categories.software.items.docs"), desc: tp("categories.software.items.docsDesc"), icon: itemIcons.docs },
            ]
        },
        {
            id: "management",
            title: tp("categories.management.title"),
            icon: categoryIcons.management,
            color: "text-amber-500",
            bgColor: "bg-amber-500/10",
            useCases: [
                { title: tp("categories.management.items.strategy"), desc: tp("categories.management.items.strategyDesc"), icon: itemIcons.strategy },
                { title: tp("categories.management.items.competition"), desc: tp("categories.management.items.competitionDesc"), icon: itemIcons.competition },
                { title: tp("categories.management.items.vision"), desc: tp("categories.management.items.visionDesc"), icon: itemIcons.vision },
            ]
        },
        {
            id: "legal",
            title: tp("categories.legal.title"),
            icon: categoryIcons.legal,
            color: "text-indigo-500",
            bgColor: "bg-indigo-500/10",
            useCases: [
                { title: tp("categories.legal.items.contracts"), desc: tp("categories.legal.items.contractsDesc"), icon: itemIcons.contracts },
                { title: tp("categories.legal.items.clauses"), desc: tp("categories.legal.items.clausesDesc"), icon: itemIcons.clauses },
                { title: tp("categories.legal.items.compliance"), desc: tp("categories.legal.items.complianceDesc"), icon: itemIcons.compliance },
                { title: tp("categories.legal.items.diligence"), desc: tp("categories.legal.items.diligenceDesc"), icon: itemIcons.diligence },
            ]
        },
    ]

    const scrollToCategory = (categoryId: string) => {
        setActiveCategory(categoryId)
        const element = document.getElementById(categoryId)
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }

    // Update active category based on scroll position
    useEffect(() => {
        const handleScroll = () => {
            const sections = categories.map(cat => ({
                id: cat.id,
                element: document.getElementById(cat.id)
            }))

            for (const section of sections.reverse()) {
                if (section.element) {
                    const rect = section.element.getBoundingClientRect()
                    if (rect.top <= 200) {
                        setActiveCategory(section.id)
                        break
                    }
                }
            }
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [categories])

    return (
        <div className="min-h-screen pt-20 bg-background">
            {/* Hero Section */}
            <section className="py-16 bg-muted/30">
                <div className="container">
                    <motion.div
                        className="text-center max-w-3xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Badge variant="outline" className="mb-4">
                            <Zap className="w-3 h-3 mr-1" />
                            {tp("badge")}
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                            {t("headline")}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {t("pageSubheadline")}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Content with Sidebar */}
            <div className="container py-12">
                <div className="flex gap-12">
                    {/* Sticky Sidebar Navigation */}
                    <aside className="hidden lg:block w-64 shrink-0">
                        <div className="sticky top-24">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                                {t("sidebarTitle")}
                            </h3>
                            <nav className="space-y-1">
                                {categories.map((category) => {
                                    const IconComponent = category.icon
                                    return (
                                        <button
                                            key={category.id}
                                            onClick={() => scrollToCategory(category.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all ${activeCategory === category.id
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                        >
                                            <IconComponent className="w-4 h-4" />
                                            <span className="text-sm">{category.title}</span>
                                            <span className="ml-auto text-xs text-muted-foreground">
                                                {category.useCases.length}
                                            </span>
                                        </button>
                                    )
                                })}
                            </nav>
                        </div>
                    </aside>

                    {/* Use Cases Content */}
                    <main className="flex-1 space-y-20">
                        {categories.map((category) => {
                            const CategoryIcon = category.icon
                            return (
                                <section key={category.id} id={category.id}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        {/* Category Header */}
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className={`w-12 h-12 rounded-xl ${category.bgColor} flex items-center justify-center`}>
                                                <CategoryIcon className={`w-6 h-6 ${category.color}`} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-foreground">
                                                    {category.title}
                                                </h2>
                                                <p className="text-muted-foreground">
                                                    {t("useCasesCount", { count: category.useCases.length })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Use Case Cards Grid */}
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {category.useCases.map((useCase, index) => {
                                                const UseCaseIcon = useCase.icon
                                                return (
                                                    <motion.div
                                                        key={index}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        whileInView={{ opacity: 1, y: 0 }}
                                                        viewport={{ once: true }}
                                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                                    >
                                                        <Card className="h-full hover:shadow-lg hover:border-primary/30 transition-all group cursor-pointer overflow-hidden">
                                                            <CardContent className="p-6">
                                                                <div className="flex gap-4">
                                                                    {/* Icon */}
                                                                    <div className={`w-10 h-10 rounded-lg ${category.bgColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                                                        <UseCaseIcon className={`w-5 h-5 ${category.color}`} />
                                                                    </div>

                                                                    {/* Content */}
                                                                    <div className="flex-1">
                                                                        <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                                                                            {useCase.title}
                                                                        </h3>
                                                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                                                            {useCase.desc}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                </section>
                            )
                        })}

                        {/* CTA Section */}
                        <motion.div
                            className="py-12 text-center"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                                <CardContent className="p-12">
                                    <h3 className="text-2xl font-bold text-foreground mb-4">
                                        {t("ctaHeadline")}
                                    </h3>
                                    <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                                        {t("ctaDescription")}
                                    </p>
                                    <Button size="lg" asChild>
                                        <Link href={`/${locale}/contact`}>
                                            {t("ctaButton")}
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </main>
                </div>
            </div>
        </div>
    )
}
