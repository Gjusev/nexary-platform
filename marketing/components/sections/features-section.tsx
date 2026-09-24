"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import {
    Shield,
    Layers,
    Brain,
    Zap,
    Eye,
    Plug,
} from "lucide-react"

export function FeaturesSection() {
    const t = useTranslations("features")

    const features = [
        {
            icon: Shield,
            title: t("gdpr.title"),
            description: t("gdpr.description"),
        },
        {
            icon: Layers,
            title: t("multiModel.title"),
            description: t("multiModel.description"),
        },
        {
            icon: Brain,
            title: t("rag.title"),
            description: t("rag.description"),
        },
        {
            icon: Zap,
            title: t("automation.title"),
            description: t("automation.description"),
        },
        {
            icon: Eye,
            title: t("transparency.title"),
            description: t("transparency.description"),
        },
        {
            icon: Plug,
            title: t("integration.title"),
            description: t("integration.description"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28" id="features">
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
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card className="h-full hover:shadow-lg transition-shadow group">
                                <CardContent className="p-6">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                        <feature.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">
                                        {feature.title}
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
