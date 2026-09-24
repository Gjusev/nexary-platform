"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

export default function AgbPage() {
    const t = useTranslations("legal.agb")

    const sections = [
        "praembel",
        "definitionen",
        "allgemeine_regelungen",
        "preismodell",
        "plattform_zugriff",
        "gewaehrleistung",
        "laufzeit_kuendigung",
        "haftungsbeschraenkung",
        "schlussbestimmungen"
    ]

    return (
        <div className="min-h-screen py-20 md:py-28">
            <div className="container max-w-4xl">
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h1>
                    <p className="text-muted-foreground">{t("updated")}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card>
                        <CardContent className="p-6 md:p-10 space-y-8">
                            {sections.map((section) => (
                                <div key={section}>
                                    <h2 className="text-xl md:text-2xl font-semibold mb-4 text-foreground">
                                        {t(section)}
                                    </h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t(`${section}_content`)}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
