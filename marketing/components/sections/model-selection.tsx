"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Zap, Brain } from "lucide-react"

export function ModelSelectionSection() {
    const t = useTranslations("modelSelection")

    const models = [
        {
            icon: Brain,
            title: t("models.gpt4.title"),
            description: t("models.gpt4.description"),
            useCases: t("models.gpt4.useCases"),
            badge: "Premium",
        },
        {
            icon: Zap,
            title: t("models.gpt35.title"),
            description: t("models.gpt35.description"),
            useCases: t("models.gpt35.useCases"),
            badge: "Fast",
        },
        {
            icon: Sparkles,
            title: t("models.local.title"),
            description: t("models.local.description"),
            useCases: t("models.local.useCases"),
            badge: "Secure",
        },
    ]

    const steps = [
        {
            title: t("howItWorks.step1.title"),
            description: t("howItWorks.step1.description"),
        },
        {
            title: t("howItWorks.step2.title"),
            description: t("howItWorks.step2.description"),
        },
        {
            title: t("howItWorks.step3.title"),
            description: t("howItWorks.step3.description"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30">
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

                {/* Models Grid */}
                <div className="grid md:grid-cols-3 gap-6 mb-16">
                    {models.map((model, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card className="h-full relative overflow-hidden">
                                <div className="absolute top-4 right-4">
                                    <Badge variant="secondary">{model.badge}</Badge>
                                </div>
                                <CardContent className="p-6 pt-12">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                        <model.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">
                                        {model.title}
                                    </h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        {model.description}
                                    </p>
                                    <div className="border-t pt-4">
                                        <p className="text-xs text-muted-foreground font-medium mb-1">
                                            {t("bestFor")}:
                                        </p>
                                        <p className="text-sm text-foreground">{model.useCases}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* How It Works */}
                <motion.div
                    className="max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <h3 className="text-xl font-semibold text-foreground text-center mb-8">
                        {t("howItWorks.title")}
                    </h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((step, index) => (
                            <div key={index} className="text-center">
                                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mx-auto mb-4">
                                    {index + 1}
                                </div>
                                <h4 className="font-semibold text-foreground mb-2">{step.title}</h4>
                                <p className="text-sm text-muted-foreground">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
