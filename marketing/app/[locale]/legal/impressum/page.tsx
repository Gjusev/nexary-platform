"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

export default function ImpressumPage() {
    const t = useTranslations("legal.impressum")

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
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card>
                        <CardContent className="p-6 md:p-10 space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">{t("company")}</h3>
                                <p className="text-muted-foreground">
                                    {t("address")}
                                </p>
                                <div className="space-y-1 text-muted-foreground">
                                    <p>{t("email")}</p>
                                    <p>{t("phone")}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">{t("representatives")}</h3>
                                <p className="text-muted-foreground">{t("director")}</p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Register & VAT</h3>
                                <div className="space-y-1 text-muted-foreground">
                                    <p>{t("register_info")}</p>
                                    <p>{t("court")}</p>
                                    <p>{t("vat")}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Disclaimer</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {t("liability_content")}
                                </p>
                                <p className="text-muted-foreground leading-relaxed">
                                    {t("disclaimer")}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
