"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import { useCases } from "@/content/useCases"

export function UseCasesPreview() {
    const t = useTranslations("useCases")
    const locale = useLocale() as "de" | "en" | "es"

    // Show first 3 use cases
    const previewCases = useCases.slice(0, 3)

    const categoryLabels: Record<string, string> = {
        finance: t("finance"),
        healthcare: t("healthcare"),
        legal: t("legal"),
        retail: t("retail"),
        industry: t("industry"),
        public: t("public"),
    }

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30">
            <div className="container">
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

                <div className="grid md:grid-cols-3 gap-6 mb-10">
                    {previewCases.map((useCase, index) => (
                        <motion.div
                            key={useCase.slug}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Link href={`/${locale}/use-cases/${useCase.slug}`}>
                                <Card className="h-full hover:shadow-lg transition-shadow group cursor-pointer">
                                    <CardContent className="p-6">
                                        <Badge variant="secondary" className="mb-4">
                                            {categoryLabels[useCase.category]}
                                        </Badge>
                                        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            {useCase.titles[locale]}
                                        </h3>
                                        <p className="text-muted-foreground text-sm line-clamp-2">
                                            {useCase.summaries[locale]}
                                        </p>
                                        <div className="flex items-center gap-1 mt-4 text-primary text-sm font-medium">
                                            <span>{useCase.ctaLabel[locale]}</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
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
                    <Link href={`/${locale}/use-cases`}>
                        <Button variant="outline" size="lg">
                            {t("viewAll")}
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
