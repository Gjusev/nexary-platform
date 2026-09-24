"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Shield, Award, MapPin } from "lucide-react"

export function SecuritySection() {
    const t = useTranslations("security")

    const badges = [
        {
            icon: Shield,
            title: t("gdpr"),
            description: t("gdprDesc"),
        },
        {
            icon: MapPin,
            title: t("madeInGermany"),
            description: t("madeInGermanyDesc"),
        },
        {
            icon: Award,
            title: t("iso"),
            description: t("isoDesc"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28" id="security">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="premium" className="mb-4">
                        <Shield className="w-3 h-3 mr-1" />
                        Enterprise Security
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    {badges.map((badge, index) => (
                        <motion.div
                            key={index}
                            className="flex flex-col items-center text-center p-8 rounded-2xl bg-card border hover:shadow-lg transition-shadow"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                                <badge.icon className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">
                                {badge.title}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                {badge.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
