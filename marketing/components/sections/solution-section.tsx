"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Users, Lock, Puzzle, ArrowRight } from "lucide-react"

export function SolutionSection() {
    const t = useTranslations("solution")
    const locale = useLocale()

    const benefits = [
        {
            icon: Users,
            title: t("benefit1"),
        },
        {
            icon: Lock,
            title: t("benefit2"),
        },
        {
            icon: Puzzle,
            title: t("benefit3"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30">
            <div className="container">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                            {t("headline")}
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t("subheadline")}
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        {benefits.map((benefit, index) => (
                            <motion.div
                                key={index}
                                className="flex flex-col items-center text-center p-8 rounded-2xl glass-card"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <benefit.icon className="w-7 h-7 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        <Link href={`/${locale}/register`}>
                            <Button size="lg" className="group">
                                {t("ctaPrimary")}
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
