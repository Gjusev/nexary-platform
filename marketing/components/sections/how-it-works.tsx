"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Database, Settings, Users } from "lucide-react"

export function HowItWorksSection() {
    const t = useTranslations("howItWorks")

    const steps = [
        {
            icon: Database,
            title: t("step1.title"),
            description: t("step1.description"),
        },
        {
            icon: Settings,
            title: t("step2.title"),
            description: t("step2.description"),
        },
        {
            icon: Users,
            title: t("step3.title"),
            description: t("step3.description"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
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

                <div className="max-w-5xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* Connection Line (hidden on mobile) */}
                        <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                className="relative flex flex-col items-center text-center"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.15 }}
                            >
                                {/* Step Number */}
                                <div className="relative z-10 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-6 shadow-lg">
                                    <step.icon className="w-7 h-7" />
                                </div>

                                {/* Content */}
                                <h3 className="text-xl font-semibold text-foreground mb-2">
                                    {step.title}
                                </h3>
                                <p className="text-muted-foreground text-sm max-w-xs">
                                    {step.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
