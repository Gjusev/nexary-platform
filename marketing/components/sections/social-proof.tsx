"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"

const companyLogos = [
    { name: "Company 1", width: 120 },
    { name: "Company 2", width: 100 },
    { name: "Company 3", width: 110 },
    { name: "Company 4", width: 90 },
    { name: "Company 5", width: 130 },
    { name: "Company 6", width: 100 },
]

export function SocialProof() {
    const t = useTranslations("socialProof")

    return (
        <section className="w-full py-12 md:py-16 border-y bg-muted/30">
            <div className="container">
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                        {t("trustedBy")}
                    </p>
                </motion.div>

                <motion.div
                    className="flex flex-wrap justify-center items-center gap-8 md:gap-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    {companyLogos.map((logo, index) => (
                        <div
                            key={logo.name}
                            className="flex items-center justify-center h-12 opacity-50 hover:opacity-100 transition-opacity"
                            style={{ width: logo.width }}
                        >
                            {/* Placeholder logo - replace with actual logos */}
                            <div className="bg-muted-foreground/20 rounded-md h-8 w-full flex items-center justify-center">
                                <span className="text-xs text-muted-foreground font-medium">
                                    Logo {index + 1}
                                </span>
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
