"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Star, Zap, Building2, Rocket, ChevronDown, Shield, Lock, Server } from "lucide-react"

interface PricingTier {
    id: string
    icon: React.ComponentType<{ className?: string }>
    popular?: boolean
    features: string[]
}

const pricingTiers: PricingTier[] = [
    {
        id: "starter",
        icon: Zap,
        features: [
            "accessToGpt4",
            "basicRag",
            "upTo5Users",
            "emailSupport",
            "gdprCompliant",
        ],
    },
    {
        id: "professional",
        icon: Rocket,
        popular: true,
        features: [
            "allStarterFeatures",
            "multiModelAccess",
            "advancedRag",
            "upTo25Users",
            "prioritySupport",
            "customWorkflows",
        ],
    },
    {
        id: "business",
        icon: Building2,
        features: [
            "allProfessionalFeatures",
            "upTo100Users",
            "ssoIntegration",
            "advancedAnalytics",
            "dedicatedManager",
            "customIntegrations",
        ],
    },
    {
        id: "enterprise",
        icon: Star,
        features: [
            "allBusinessFeatures",
            "unlimitedUsers",
            "onPremiseDeployment",
            "customSla",
            "whiteLabeling",
            "priorityDevelopment",
        ],
    },
]

// Feature comparison data
const comparisonFeatures = [
    { key: "users", starter: "5", professional: "25", business: "100", enterprise: "unlimited" },
    { key: "models", starter: "GPT-4", professional: "allModels", business: "allModels", enterprise: "allPlusCustom" },
    { key: "rag", starter: true, professional: true, business: true, enterprise: true },
    { key: "workflows", starter: false, professional: true, business: true, enterprise: true },
    { key: "sso", starter: false, professional: false, business: true, enterprise: true },
    { key: "analytics", starter: "basic", professional: "advanced", business: "advanced", enterprise: "custom" },
    { key: "support", starter: "Email", professional: "Priority", business: "Dedicated", enterprise: "24/7" },
    { key: "onpremise", starter: false, professional: false, business: false, enterprise: true },
    { key: "api", starter: false, professional: true, business: true, enterprise: true },
    { key: "audit", starter: false, professional: false, business: true, enterprise: true },
]

export function PricingSection() {
    const t = useTranslations("pricing")
    const tc = useTranslations("common")
    const [isAnnual, setIsAnnual] = useState(true)
    const [showComparison, setShowComparison] = useState(false)

    const renderFeatureValue = (value: boolean | string) => {
        if (typeof value === "boolean") {
            return value ? (
                <Check className="w-5 h-5 text-green-500" />
            ) : (
                <X className="w-5 h-5 text-muted-foreground/30" />
            )
        }
        // Translate known keys
        if (["unlimited", "allModels", "allPlusCustom", "basic", "advanced", "dedicated"].includes(value)) {
            return <span className="text-sm font-medium">{t(`comparison.${value}`)}</span>
        }
        return <span className="text-sm font-medium">{value}</span>
    }

    return (
        <section className="w-full py-20 md:py-28" id="pricing">
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
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                        {t("subheadline")}
                    </p>

                    {/* Annual/Monthly Toggle */}
                    <div className="flex items-center justify-center gap-4">
                        <span className={`text-sm font-medium transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                            {t("monthly")}
                        </span>
                        <motion.button
                            className="relative w-14 h-7 bg-muted rounded-full p-1"
                            onClick={() => setIsAnnual(!isAnnual)}
                            whileTap={{ scale: 0.95 }}
                        >
                            <motion.div
                                className="w-5 h-5 bg-primary rounded-full shadow-lg"
                                animate={{ x: isAnnual ? 28 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        </motion.button>
                        <span className={`text-sm font-medium transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                            {t("annual")}
                        </span>
                        {isAnnual && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full"
                            >
                                {t("savePercent")}
                            </motion.span>
                        )}
                    </div>
                </motion.div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                    {pricingTiers.map((tier, index) => {
                        const IconComponent = tier.icon
                        const isPopular = tier.popular

                        return (
                            <motion.div
                                key={tier.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card
                                    className={`
                                        relative h-full flex flex-col overflow-hidden
                                        backdrop-blur-xl
                                        ${isPopular
                                            ? "border-primary shadow-xl shadow-primary/10 bg-gradient-to-br from-primary/5 via-background to-background"
                                            : "border-border bg-card/50 hover:border-primary/50"
                                        }
                                        transition-all duration-300 hover:shadow-lg
                                    `}
                                >
                                    {/* Popular Badge */}
                                    {isPopular && (
                                        <div className="absolute top-0 right-0">
                                            <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                                                {t("mostPopular")}
                                            </div>
                                        </div>
                                    )}

                                    <CardHeader className="pb-4">
                                        <div className={`
                                            w-12 h-12 rounded-xl flex items-center justify-center mb-4
                                            ${isPopular ? "bg-primary/20" : "bg-muted"}
                                        `}>
                                            <IconComponent className={`w-6 h-6 ${isPopular ? "text-primary" : "text-muted-foreground"}`} />
                                        </div>
                                        <h3 className="text-xl font-bold text-foreground">
                                            {t(`tiers.${tier.id}.name`)}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t(`tiers.${tier.id}.description`)}
                                        </p>
                                    </CardHeader>

                                    <CardContent className="flex-1">
                                        {/* Price */}
                                        <div className="mb-6">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-bold text-foreground">
                                                    {tier.id === "enterprise"
                                                        ? t("custom")
                                                        : t(`tiers.${tier.id}.${isAnnual ? "priceAnnual" : "priceMonthly"}`)}
                                                </span>
                                                {tier.id !== "enterprise" && (
                                                    <span className="text-muted-foreground">
                                                        /{t("perMonth")}
                                                    </span>
                                                )}
                                            </div>
                                            {tier.id !== "enterprise" && isAnnual && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {t("billedAnnually")}
                                                </p>
                                            )}
                                        </div>

                                        {/* Features List */}
                                        <ul className="space-y-3">
                                            {tier.features.map((feature, featureIndex) => (
                                                <motion.li
                                                    key={feature}
                                                    className="flex items-start gap-3"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    whileInView={{ opacity: 1, x: 0 }}
                                                    viewport={{ once: true }}
                                                    transition={{ delay: featureIndex * 0.05 }}
                                                >
                                                    <Check className={`w-5 h-5 mt-0.5 shrink-0 ${isPopular ? "text-primary" : "text-green-500"}`} />
                                                    <span className="text-sm text-muted-foreground">
                                                        {t(`features.${feature}`)}
                                                    </span>
                                                </motion.li>
                                            ))}
                                        </ul>
                                    </CardContent>

                                    <CardFooter className="pt-4">
                                        <Button
                                            className={`w-full ${isPopular ? "" : "variant-outline"}`}
                                            variant={isPopular ? "default" : "outline"}
                                            size="lg"
                                        >
                                            {tier.id === "enterprise" ? t("contactSales") : t("getStarted")}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Feature Comparison Toggle */}
                <motion.div
                    className="text-center mt-12"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <Button
                        variant="ghost"
                        onClick={() => setShowComparison(!showComparison)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {showComparison ? tc("hideComparison") : tc("compareFeatures")}
                        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showComparison ? "rotate-180" : ""}`} />
                    </Button>
                </motion.div>

                {/* Feature Comparison Table */}
                <AnimatePresence>
                    {showComparison && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                        >
                            <div className="max-w-6xl mx-auto mt-8 overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-4 px-4 text-foreground font-semibold">{t("comparison.featureColumn")}</th>
                                            <th className="text-center py-4 px-4 text-foreground font-semibold">{t("tiers.starter.name")}</th>
                                            <th className="text-center py-4 px-4 text-primary font-semibold bg-primary/5">{t("tiers.professional.name")}</th>
                                            <th className="text-center py-4 px-4 text-foreground font-semibold">{t("tiers.business.name")}</th>
                                            <th className="text-center py-4 px-4 text-foreground font-semibold">{t("tiers.enterprise.name")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonFeatures.map((feature, index) => (
                                            <tr key={feature.key} className={`border-b border-border ${index % 2 === 0 ? "bg-muted/20" : ""}`}>
                                                <td className="py-3 px-4 text-sm text-foreground">{t(`comparison.labels.${feature.key}`)}</td>
                                                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.starter)}</td>
                                                <td className="py-3 px-4 text-center bg-primary/5">{renderFeatureValue(feature.professional)}</td>
                                                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.business)}</td>
                                                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.enterprise)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Trust Badges */}
                <motion.div
                    className="flex flex-wrap items-center justify-center gap-4 mt-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <Badge variant="outline" className="px-4 py-2 text-sm gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        {tc("gdprCompliant")}
                    </Badge>
                    <Badge variant="outline" className="px-4 py-2 text-sm gap-2">
                        <Lock className="w-4 h-4 text-blue-500" />
                        {tc("iso27001")}
                    </Badge>
                    <Badge variant="outline" className="px-4 py-2 text-sm gap-2">
                        <Server className="w-4 h-4 text-purple-500" />
                        {tc("euHosting")}
                    </Badge>
                </motion.div>

                {/* Bottom CTA */}
                <motion.div
                    className="text-center mt-12"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <p className="text-muted-foreground">
                        {t("needHelp")}{" "}
                        <a href="#contact" className="text-primary hover:underline font-medium">
                            {t("talkToUs")}
                        </a>
                    </p>
                </motion.div>
            </div>
        </section>
    )
}

