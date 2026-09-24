"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import {
    RefreshCw,
    Target,
    GraduationCap,
    Zap,
    ThumbsUp,
    Puzzle,
} from "lucide-react"

const benefits = [
    {
        id: "currentData",
        icon: RefreshCw,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
    },
    {
        id: "precision",
        icon: Target,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
    },
    {
        id: "expertise",
        icon: GraduationCap,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
    },
    {
        id: "efficiency",
        icon: Zap,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
    },
    {
        id: "acceptance",
        icon: ThumbsUp,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
    },
    {
        id: "flexibility",
        icon: Puzzle,
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
    },
]

export function RAGBenefitsSection() {
    const t = useTranslations("ragBenefits")

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30" id="rag-benefits">
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
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {benefits.map((benefit, index) => {
                        const IconComponent = benefit.icon
                        return (
                            <motion.div
                                key={benefit.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="h-full hover:shadow-lg transition-shadow group">
                                    <CardContent className="p-6">
                                        <div className={`w-12 h-12 rounded-xl ${benefit.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                            <IconComponent className={`w-6 h-6 ${benefit.color}`} />
                                        </div>
                                        <h3 className="text-lg font-semibold text-foreground mb-2">
                                            {t(`benefits.${benefit.id}.title`)}
                                        </h3>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            {t(`benefits.${benefit.id}.description`)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
