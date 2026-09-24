"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SubpageHero } from "@/components/sections/subpage-hero"
import { RAGFlowDiagram } from "@/components/sections/rag-flow-diagram"
import { RAGBenefitsSection } from "@/components/sections/rag-benefits-section"
import { TrainingSection } from "@/components/sections/training-section"
import { EnterpriseOnboarding } from "@/components/sections/enterprise-onboarding"
import { SecuritySection } from "@/components/sections/security-section"
import { DeploymentOptions } from "@/components/sections/deployment-options"
import { IntegrationsSection } from "@/components/sections/integrations-section"
import { FAQSection } from "@/components/sections/faq-section"
import {
    Layers,
    Brain,
    Zap,
    Plug,
    Shield,
    ArrowRight,
    CheckCircle,
} from "lucide-react"
import { EXTERNAL_URLS } from "@/lib/constants"


export default function PlatformPage() {
    const t = useTranslations("platform")
    const tc = useTranslations("cta")

    const modules = [
        {
            icon: Layers,
            title: t("modules.multiProvider.title"),
            description: t("modules.multiProvider.desc"),
        },
        {
            icon: Brain,
            title: t("modules.rag.title"),
            description: t("modules.rag.desc"),
        },
        {
            icon: Zap,
            title: t("modules.automation.title"),
            description: t("modules.automation.desc"),
        },
        {
            icon: Plug,
            title: t("modules.api.title"),
            description: t("modules.api.desc"),
        },
    ]

    const comparisonPoints = [
        { nexary: true, text: t("comparison.points.gdpr") },
        { nexary: true, text: t("comparison.points.multi") },
        { nexary: true, text: t("comparison.points.rag") },
        { nexary: true, text: t("comparison.points.workflow") },
        { nexary: true, text: t("comparison.points.audit") },
        { nexary: true, text: t("comparison.points.cloud") },
    ]

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <SubpageHero
                tag={t("tag")}
                tagIcon={Shield}
                headline={t("headline")}
                subheadline={t("subheadline")}
                ctaText={tc("button")}
                ctaHref={EXTERNAL_URLS.nexus.register}
            />


            {/* Architecture */}
            <section className="py-16 bg-muted/30" id="features">
                <div className="container">
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-4">
                            {t("architecture.title")}
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            {t("architecture.desc")}
                        </p>
                    </motion.div>

                    {/* Architecture Diagram - Interactive ReactFlow */}
                    <motion.div
                        className="max-w-5xl mx-auto mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <RAGFlowDiagram />
                    </motion.div>

                    {/* Modules */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {modules.map((module, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="h-full">
                                    <CardContent className="p-6 flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <module.icon className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                                {module.title}
                                            </h3>
                                            <p className="text-muted-foreground text-sm">
                                                {module.description}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Integrations */}
            <IntegrationsSection />

            {/* Deployment Options */}
            <DeploymentOptions />

            {/* Comparison */}
            <section className="py-20">
                <div className="container">
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-4">
                            {t("comparison.title")}
                        </h2>
                        <p className="text-muted-foreground">
                            {t("comparison.desc")}
                        </p>
                    </motion.div>

                    <motion.div
                        className="max-w-2xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Card>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {comparisonPoints.map((point, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                                            <span className="text-foreground">{point.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </section>

            {/* RAG Benefits Section */}
            <RAGBenefitsSection />

            {/* Enterprise Onboarding Section */}
            <EnterpriseOnboarding />

            {/* Training Section */}
            <TrainingSection />

            {/* Security Section (Added for more content) */}
            <SecuritySection />

            {/* FAQ */}
            <div className="py-20">
                <FAQSection />
            </div>


            {/* CTA */}
            <section className="py-20 bg-muted/30">
                <div className="container">
                    <motion.div
                        className="text-center max-w-2xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-4">
                            {t("cta.headline")}
                        </h2>
                        <p className="text-muted-foreground mb-8">
                            {t("cta.description")}
                        </p>
                        <Link href={EXTERNAL_URLS.nexus.register}>
                            <Button size="lg">
                                {t("cta.button")}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>

                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}
