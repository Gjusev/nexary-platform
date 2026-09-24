"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Brain,
    Search,
    Image,
    Bot,
    Globe,
    Code,
    Layers,
    Zap,
    Shield,
    FileText,
    BarChart,
    ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const features = [
    {
        id: "multiModel",
        icon: Layers,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        highlight: true,
    },
    {
        id: "rag",
        icon: Brain,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        highlight: false,
    },
    {
        id: "assistants",
        icon: Bot,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        highlight: false,
    },
    {
        id: "webSearch",
        icon: Globe,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
        highlight: false,
    },
    {
        id: "imageGen",
        icon: Image,
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
        highlight: false,
    },
    {
        id: "codeInterpreter",
        icon: Code,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        highlight: false,
    },
    {
        id: "deepResearch",
        icon: Search,
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
        highlight: false,
    },
    {
        id: "documentChat",
        icon: FileText,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        highlight: false,
    },
    {
        id: "analytics",
        icon: BarChart,
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
        highlight: false,
    },
]

export function ExtendedFeaturesSection() {
    const t = useTranslations("extendedFeatures")
    const tc = useTranslations("common")

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30" id="features">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-4">
                        <Zap className="w-3 h-3 mr-1" />
                        Enterprise Features
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                {/* Main Feature - Multi-Model */}
                <motion.div
                    className="max-w-4xl mx-auto mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-8 md:p-12">
                            <div className="grid md:grid-cols-2 gap-8 items-center">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                                        <Layers className="w-7 h-7 text-primary" />
                                    </div>
                                    <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                                        {t("features.multiModel.title")}
                                    </h3>
                                    <p className="text-muted-foreground mb-6 leading-relaxed">
                                        {t("features.multiModel.description")}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {["GPT-4o", "Claude 3.5", "Gemini 2.0", "Mistral", "Llama 3"].map((model) => (
                                            <Badge key={model} variant="secondary">
                                                {model}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-card rounded-xl p-6 border">
                                    <div className="text-sm font-medium text-muted-foreground mb-4">{tc("smartSelectAi")}</div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm">{tc("complexAnalysis")}</span>
                                            <Badge className="bg-blue-500/10 text-blue-500">GPT-4o</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm">{tc("creativeContent")}</span>
                                            <Badge className="bg-purple-500/10 text-purple-500">Claude 3.5</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm">{tc("quickTasks")}</span>
                                            <Badge className="bg-green-500/10 text-green-500">Gemini Flash</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    {features.slice(1).map((feature, index) => {
                        const IconComponent = feature.icon
                        return (
                            <motion.div
                                key={feature.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: index * 0.05 }}
                            >
                                <Card className="h-full hover:shadow-lg hover:border-primary/30 transition-all group">
                                    <CardContent className="p-6">
                                        <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                            <IconComponent className={`w-6 h-6 ${feature.color}`} />
                                        </div>
                                        <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            {t(`features.${feature.id}.title`)}
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {t(`features.${feature.id}.description`)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Security Footer */}
                <motion.div
                    className="mt-12 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <div className="flex flex-wrap justify-center gap-6 mb-8">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Shield className="w-5 h-5 text-primary" />
                            <span>{tc("gdprCompliant")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Shield className="w-5 h-5 text-primary" />
                            <span>{tc("iso27001")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Shield className="w-5 h-5 text-primary" />
                            <span>{tc("euHosting")}</span>
                        </div>
                    </div>
                    <Button size="lg">
                        {tc("allFeaturesButton")}
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </motion.div>
            </div>
        </section>
    )
}
