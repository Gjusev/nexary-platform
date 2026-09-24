"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Compass,
    Rocket,
    TrendingUp,
    Check,
} from "lucide-react"

const phases = [
    {
        id: "foundation",
        icon: Compass,
        color: "text-blue-500",
        bgColor: "bg-blue-500",
        number: "01",
    },
    {
        id: "integration",
        icon: Rocket,
        color: "text-purple-500",
        bgColor: "bg-purple-500",
        number: "02",
    },
    {
        id: "scaling",
        icon: TrendingUp,
        color: "text-green-500",
        bgColor: "bg-green-500",
        number: "03",
    },
]

export function EnterpriseOnboarding() {
    const t = useTranslations("enterpriseOnboarding")
    const tc = useTranslations("common")

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30" id="enterprise-onboarding">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-4">
                        {tc("enterprise")}
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                {/* Timeline */}
                <div className="max-w-5xl mx-auto">
                    <div className="relative">
                        {/* Connection Line */}
                        <div className="hidden lg:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 opacity-20" />

                        <div className="grid lg:grid-cols-3 gap-8">
                            {phases.map((phase, index) => {
                                const IconComponent = phase.icon
                                return (
                                    <motion.div
                                        key={phase.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: index * 0.2 }}
                                    >
                                        <Card className="h-full relative overflow-hidden group hover:shadow-xl transition-all">
                                            {/* Phase Number */}
                                            <div className={`absolute top-0 right-0 w-20 h-20 ${phase.bgColor} opacity-10 rounded-bl-full`} />
                                            <div className="absolute top-4 right-4 text-4xl font-bold text-muted-foreground/20">
                                                {phase.number}
                                            </div>

                                            <CardContent className="p-6 pt-8">
                                                {/* Icon */}
                                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${phase.bgColor}/20 to-${phase.bgColor}/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                                    <IconComponent className={`w-7 h-7 ${phase.color}`} />
                                                </div>

                                                {/* Title */}
                                                <h3 className="text-xl font-bold text-foreground mb-3">
                                                    {t(`phases.${phase.id}.title`)}
                                                </h3>

                                                {/* Duration */}
                                                <Badge variant="secondary" className="mb-4">
                                                    {t(`phases.${phase.id}.duration`)}
                                                </Badge>

                                                {/* Description */}
                                                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                                                    {t(`phases.${phase.id}.description`)}
                                                </p>

                                                {/* Checklist */}
                                                <ul className="space-y-2">
                                                    {[1, 2, 3].map((item) => (
                                                        <li key={item} className="flex items-start gap-2 text-sm">
                                                            <Check className={`w-4 h-4 mt-0.5 ${phase.color} shrink-0`} />
                                                            <span className="text-muted-foreground">
                                                                {t(`phases.${phase.id}.items.${item}`)}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
