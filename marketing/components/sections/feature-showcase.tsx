"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
    MessageSquare,
    Database,
    Bot,
    Files,
    Layers,
    CheckCircle2,
} from "lucide-react"
import { RAGFlowDiagram } from "@/components/sections/rag-flow-diagram"

import { useTheme } from "next-themes"

export function FeatureShowcase() {
    const t = useTranslations("featureShowcase")
    const { resolvedTheme } = useTheme()
    const [activeFeature, setActiveFeature] = useState("chat")
    const [mounted, setMounted] = useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    const features = [
        {
            id: "chat",
            icon: MessageSquare,
            visualDark: "/images/feature_chat_mockup.png",
            visualLight: "/images/feature_chat_mockup_light.png",
        },
        {
            id: "knowledge",
            icon: Database,
            visualDark: "rag_diagram",
            visualLight: "rag_diagram",
        },
        {
            id: "assistants",
            icon: Bot,
            visualDark: "/images/feature_assistants_grid.png",
            visualLight: "/images/feature_assistants_grid_light.png",
        },
        {
            id: "multimodal",
            icon: Files,
            visualDark: "/images/feature_multimodal_preview.png",
            visualLight: "/images/feature_multimodal_preview_light.png",
        },
        {
            id: "platform",
            icon: Layers,
            visualDark: "/images/feature_platform_hub.png",
            visualLight: "/images/feature_platform_hub_light.png",
        },
    ]

    return (
        <section className="w-full py-20 md:py-32 bg-muted/30" id="features">
            <div className="container">
                <div className="mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
                        {t("headline")}
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        {t("subheadline")}
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-12 items-start">
                    {/* Left Column: Accordion / Interactive List */}
                    <div className="lg:col-span-4 space-y-4">
                        {features.map((feature) => {
                            const isActive = activeFeature === feature.id
                            const Icon = feature.icon

                            return (
                                <div
                                    key={feature.id}
                                    className={cn(
                                        "group rounded-xl transition-all duration-300 cursor-pointer overflow-hidden",
                                        isActive
                                            ? "bg-background shadow-lg border-primary/20 border"
                                            : "hover:bg-background/50 border border-transparent"
                                    )}
                                    onClick={() => setActiveFeature(feature.id)}
                                >
                                    <div className="p-6 flex items-start gap-4">
                                        <div
                                            className={cn(
                                                "p-3 rounded-lg transition-colors",
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground group-hover:text-primary"
                                            )}
                                        >
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3
                                                className={cn(
                                                    "text-lg font-bold mb-2 transition-colors",
                                                    isActive ? "text-primary" : "text-foreground"
                                                )}
                                            >
                                                {t(`features.${feature.id}.title`)}
                                            </h3>

                                            {/* Expandable Description */}
                                            <AnimatePresence>
                                                {isActive && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                                                            {t(`features.${feature.id}.description`)}
                                                        </p>
                                                        <ul className="space-y-2">
                                                            {[1, 2, 3].map((i) => (
                                                                <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                                                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                                                    <span>{t(`features.${feature.id}.point${i}`)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Right Column: Dynamic Visual */}
                    <div className="lg:col-span-8 sticky top-24">
                        <div className="relative aspect-[16/10] bg-background rounded-3xl border border-border/50 shadow-2xl overflow-hidden flex items-center justify-center p-8">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeFeature}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    transition={{ duration: 0.4 }}
                                    className="w-full h-full flex items-center justify-center"
                                >
                                    {activeFeature === "knowledge" ? (
                                        <div className="w-full h-full">
                                            <RAGFlowDiagram />
                                        </div>
                                    ) : (
                                        <div className="relative w-full h-full min-h-[300px] md:min-h-[400px]">
                                            <Image
                                                src={
                                                    (resolvedTheme === "light"
                                                        ? features.find(f => f.id === activeFeature)?.visualLight
                                                        : features.find(f => f.id === activeFeature)?.visualDark) || ""
                                                }
                                                alt={t(`features.${activeFeature}.title`)}
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Decorative background glow */}
                            <div className="absolute top-1/2 left-1/2 -transtalte-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
