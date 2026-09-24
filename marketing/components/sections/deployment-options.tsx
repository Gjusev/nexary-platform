"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Check, Cloud, Server, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function DeploymentOptions() {
    const t = useTranslations("deploymentOptions")

    const options = [
        {
            id: "saas",
            icon: Cloud,
            features: ["feature1", "feature2", "feature3", "feature4"],
        },
        {
            id: "privateCloud",
            icon: Lock,
            features: ["feature1", "feature2", "feature3", "feature4"],
            highlight: true,
        },
        {
            id: "onPremise",
            icon: Server,
            features: ["feature1", "feature2", "feature3", "feature4"],
        },
    ]

    return (
        <section className="py-20 bg-background" id="deployment">
            <div className="container">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                        {t("subheadline")}
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {options.map((option, index) => (
                        <motion.div
                            key={option.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card className={`h-full relative flex flex-col ${option.highlight ? 'border-primary shadow-lg scale-105 z-10' : 'border-border'}`}>
                                {option.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                                        {t("recommended")}
                                    </div>
                                )}
                                <CardHeader className="text-center pb-8 pt-8">
                                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                                        <option.icon className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-xl mb-2">{t(`options.${option.id}.title`)}</CardTitle>
                                    <CardDescription>{t(`options.${option.id}.description`)}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col">
                                    <ul className="space-y-4 mb-8 flex-1">
                                        {option.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm">
                                                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                <span className="text-muted-foreground">
                                                    {t(`options.${option.id}.${feature}`)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button variant={option.highlight ? "default" : "outline"} className="w-full">
                                        {t("cta")}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
