"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import {
    MessageSquare,
    Database,
    Bot,
    Image,
    Plug,
    Check,
} from "lucide-react"

interface TabData {
    id: string
    icon: React.ComponentType<{ className?: string }>
    features: string[]
}

const tabs: TabData[] = [
    {
        id: "chat",
        icon: MessageSquare,
        features: [
            "Top LLMs: OpenAI, Claude, Google & más",
            "Hosting exclusivo en EU (Frankfurt)",
            "Sin entrenamiento de modelos con tus datos",
            "Almacenamiento en tu propia nube",
        ],
    },
    {
        id: "knowledge",
        icon: Database,
        features: [
            "Sincronización automática con SharePoint, Wikis, DMS",
            "Consultas en tiempo real desde ERP, CRM, bases de datos",
            "Comprensión de procesos BPMN",
            "Preparación profesional de datos",
            "Gestión de permisos vía grupos",
        ],
    },
    {
        id: "assistants",
        icon: Bot,
        features: [
            "Eficiencia y calidad garantizada con asistentes propios",
            "Almacena conocimiento, plantillas y documentos de referencia",
            "Creación fácil vía chat",
            "Comportamiento agéntico con uso autónomo de herramientas",
        ],
    },
    {
        id: "multimodal",
        icon: Image,
        features: [
            "Resumen y Q&A de documentos",
            "Transcripción de audio y video",
            "Reconocimiento de escritura",
            "Lectura de PDFs con layout",
            "Generación de imágenes",
        ],
    },
    {
        id: "platform",
        icon: Plug,
        features: [
            "Protocolo MCP estandarizado para flexibilidad",
            "Integración fácil de herramientas internas y externas",
            "Human-in-the-Loop para comunicación segura",
            "Integraciones personalizadas en tu infraestructura",
        ],
    },
]

export function FeatureTabs() {
    const t = useTranslations("featureTabs")
    const [activeTab, setActiveTab] = useState("chat")

    const activeTabData = tabs.find((tab) => tab.id === activeTab)

    return (
        <section className="w-full py-20 md:py-28" id="feature-tabs">
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

                {/* Tabs Navigation */}
                <motion.div
                    className="flex flex-wrap justify-center gap-2 md:gap-4 mb-10"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    {tabs.map((tab) => {
                        const IconComponent = tab.icon
                        const isActive = activeTab === tab.id

                        return (
                            <motion.button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
                                    transition-all duration-300 border
                                    ${isActive
                                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                                        : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                    }
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <IconComponent className="w-4 h-4" />
                                <span>{t(`tabs.${tab.id}`)}</span>
                            </motion.button>
                        )
                    })}
                </motion.div>

                {/* Tab Content */}
                <div className="max-w-4xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="overflow-hidden">
                                <CardContent className="p-8">
                                    <div className="flex items-start gap-6">
                                        {/* Icon */}
                                        <div className="shrink-0">
                                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                                {activeTabData && (
                                                    <activeTabData.icon className="w-8 h-8 text-primary" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Features List */}
                                        <div className="flex-1">
                                            <h3 className="text-xl font-semibold text-foreground mb-4">
                                                {t(`tabs.${activeTab}`)}
                                            </h3>
                                            <ul className="space-y-3">
                                                {activeTabData?.features.map((feature, index) => (
                                                    <motion.li
                                                        key={index}
                                                        className="flex items-start gap-3"
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.1 }}
                                                    >
                                                        <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                                                        <span className="text-muted-foreground">{feature}</span>
                                                    </motion.li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
