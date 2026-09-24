"use client"

import React from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, CheckCircle, Award, Sparkles, Lock, Zap } from "lucide-react"

export function HeroSection() {
    const t = useTranslations("hero")
    const tSocial = useTranslations("socialProof")
    const locale = useLocale()

    return (
        <section className="relative w-full overflow-hidden">
            {/* SVG Background Grid */}
            <div className="absolute inset-0 z-0">
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 1220 810"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid slice"
                    className="opacity-50 dark:opacity-30"
                >
                    <defs>
                        <linearGradient
                            id="heroGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                        >
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                            <stop offset="50%" stopColor="hsl(var(--primary-light))" stopOpacity="0.05" />
                            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0" />
                        </linearGradient>
                        <pattern
                            id="heroGrid"
                            width="40"
                            height="40"
                            patternUnits="userSpaceOnUse"
                        >
                            <rect
                                width="40"
                                height="40"
                                fill="none"
                                stroke="hsl(var(--foreground))"
                                strokeOpacity="0.06"
                                strokeWidth="0.5"
                                strokeDasharray="2 2"
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#heroGradient)" />
                    <rect width="100%" height="100%" fill="url(#heroGrid)" />
                </svg>
            </div>

            {/* Gradient Orb */}
            <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-primary-light/10 rounded-full blur-[100px] -z-10" />

            <div className="container relative z-10 pt-20 pb-24 md:pt-32 md:pb-32">
                <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
                    {/* Trust Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Badge variant="premium" className="mb-6 px-4 py-1.5 text-sm">
                            <Shield className="w-4 h-4 mr-2" />
                            {tSocial("badge2")}
                        </Badge>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        {t("headline")}
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {t("subheadline")}
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        className="flex flex-col sm:flex-row gap-4 mb-10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Link href={`/${locale}/register`}>
                            <Button size="xl" className="min-w-[200px] font-semibold">
                                {t("ctaPrimary")}
                            </Button>
                        </Link>
                        <Link href={`/${locale}/register`}>
                            <Button size="xl" variant="outline" className="min-w-[200px]">
                                {t("ctaSecondary")}
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Value Props Row */}
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-3xl mx-auto mb-10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.35 }}
                    >
                        <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm border border-border rounded-lg px-4 py-3 hover:border-primary/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-foreground text-sm">{t("valueProp1Title")}</p>
                                <p className="text-xs text-muted-foreground">{t("valueProp1Desc")}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm border border-border rounded-lg px-4 py-3 hover:border-primary/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Lock className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-foreground text-sm">{t("valueProp2Title")}</p>
                                <p className="text-xs text-muted-foreground">{t("valueProp2Desc")}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm border border-border rounded-lg px-4 py-3 hover:border-primary/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-foreground text-sm">{t("valueProp3Title")}</p>
                                <p className="text-xs text-muted-foreground">{t("valueProp3Desc")}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Trust Badges */}
                    <motion.div
                        className="flex flex-wrap justify-center gap-6 md:gap-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Shield className="w-5 h-5 text-primary" />
                            <span>{tSocial("badge1")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="w-5 h-5 text-primary" />
                            <span>{tSocial("badge2")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Award className="w-5 h-5 text-primary" />
                            <span>{tSocial("badge3")}</span>
                        </div>
                    </motion.div>

                    {/* Product Screenshot */}
                    <motion.div
                        className="relative w-full max-w-4xl mx-auto mt-12"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.5 }}
                    >
                        <div className="relative rounded-xl overflow-hidden border shadow-2xl">
                            <img
                                src="/screenshots/chat-light.png"
                                alt="Nexary Chat Interface"
                                className="w-full h-auto block dark:hidden"
                            />
                            <img
                                src="/screenshots/chat-dark.png"
                                alt="Nexary Chat Interface"
                                className="w-full h-auto hidden dark:block"
                            />
                        </div>
                        {/* Gradient overlay at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
