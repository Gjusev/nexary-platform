"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { AlertTriangle, ShieldX, TrendingDown } from "lucide-react"

export function ProblemSection() {
    const t = useTranslations("problem")

    const problems = [
        {
            icon: ShieldX,
            text: t("point1"),
        },
        {
            icon: AlertTriangle,
            text: t("point2"),
        },
        {
            icon: TrendingDown,
            text: t("point3"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28">
            <div className="container">
                <div className="max-w-4xl mx-auto">
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
                        <p className="text-lg text-muted-foreground">
                            {t("subheadline")}
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {problems.map((problem, index) => (
                            <motion.div
                                key={index}
                                className="flex flex-col items-center text-center p-6 rounded-xl border bg-card hover:shadow-md transition-shadow"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                                    <problem.icon className="w-6 h-6 text-destructive" />
                                </div>
                                <p className="text-foreground font-medium">{problem.text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
