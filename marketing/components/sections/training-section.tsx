"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    BookOpen,
    MessageSquare,
    Bot,
    Wrench,
    Lightbulb,
    ArrowRight,
} from "lucide-react"

const trainingModules = [
    {
        id: "basics",
        icon: BookOpen,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        duration: "2h",
    },
    {
        id: "prompting",
        icon: MessageSquare,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        duration: "3h",
    },
    {
        id: "assistants",
        icon: Bot,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        duration: "2h",
    },
    {
        id: "workshop",
        icon: Wrench,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        duration: "4h",
    },
    {
        id: "useCases",
        icon: Lightbulb,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
        duration: "3h",
    },
]

export function TrainingSection() {
    const t = useTranslations("training")

    return (
        <section className="w-full py-20 md:py-28" id="training">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-4">
                        {t("badge")}
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                {/* Training Modules Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
                    {trainingModules.map((module, index) => {
                        const IconComponent = module.icon
                        return (
                            <motion.div
                                key={module.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all group cursor-pointer">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-xl ${module.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                <IconComponent className={`w-6 h-6 ${module.color}`} />
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                {module.duration}
                                            </Badge>
                                        </div>
                                        <h3 className="text-lg font-semibold text-foreground mb-2">
                                            {t(`modules.${module.id}.title`)}
                                        </h3>
                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                            {t(`modules.${module.id}.description`)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>

                {/* CTA */}
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                >
                    <Button size="lg">
                        {t("cta")}
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </motion.div>
            </div>
        </section>
    )
}
