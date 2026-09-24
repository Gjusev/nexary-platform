"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTASection() {
    const t = useTranslations("cta")
    const locale = useLocale()

    return (
        <section className="w-full py-20 md:py-32 relative overflow-hidden">
            {/* Background SVG with glow effect */}
            <div className="absolute inset-0 -z-10">
                <svg
                    className="w-full h-full"
                    viewBox="0 0 1388 500"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMidYMid slice"
                >
                    <defs>
                        <radialGradient
                            id="ctaGlow"
                            cx="0.5"
                            cy="0.2"
                            r="0.8"
                            fx="0.5"
                            fy="0.2"
                        >
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="hsl(var(--primary-light))" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <ellipse
                        cx="694"
                        cy="100"
                        rx="600"
                        ry="300"
                        fill="url(#ctaGlow)"
                    />
                </svg>
            </div>

            <div className="container relative z-10">
                <motion.div
                    className="max-w-3xl mx-auto text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-xl text-foreground/80 mb-2">
                        {t("subheadline")}
                    </p>
                    <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
                        {t("description")}
                    </p>
                    <Link href={`/${locale}/register`}>
                        <Button size="xl" className="group font-semibold shadow-lg shadow-primary/20">
                            {t("button")}
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
