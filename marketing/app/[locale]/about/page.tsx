"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SubpageHero } from "@/components/sections/subpage-hero"
import { ArrowRight, Shield, Lightbulb, Lock, Users } from "lucide-react"
import { EXTERNAL_URLS } from "@/lib/constants"

export default function AboutPage() {
    const t = useTranslations("about")
    const tc = useTranslations("cta")

    const values = [
        {
            icon: Shield,
            title: t("values.trust"),
            description: t("values.trustDesc"),
        },
        {
            icon: Lightbulb,
            title: t("values.innovation"),
            description: t("values.innovationDesc"),
        },
        {
            icon: Lock,
            title: t("values.security"),
            description: t("values.securityDesc"),
        },
    ]

    const teamMembers = [
        { name: "Max Mustermann", role: "CEO & Gründer", initials: "MM" },
        { name: "Anna Schmidt", role: "CTO", initials: "AS" },
        { name: "Thomas Weber", role: "Head of Product", initials: "TW" },
        { name: "Lisa Müller", role: "Head of Sales", initials: "LM" },
    ]

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <SubpageHero
                tag={t("tagline")}
                tagIcon={Users}
                headline={t("headline")}
                subheadline={t("mission")}
                ctaText={tc("button")}
                ctaHref={EXTERNAL_URLS.nexus.register}
            />


            {/* Mission */}
            <section className="py-16 bg-muted/30">
                <div className="container">
                    <motion.div
                        className="max-w-3xl mx-auto text-center"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-2xl font-bold text-foreground mb-4">
                            {t("mission")}
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {t("missionDesc")}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Values */}
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
                            {t("values.headline")}
                        </h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {values.map((value, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="h-full text-center">
                                    <CardContent className="p-6">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                            <value.icon className="w-7 h-7 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-foreground mb-2">
                                            {value.title}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">
                                            {value.description}
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team */}
            <section className="py-20 bg-muted/30">
                <div className="container">
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-4">
                            {t("team.headline")}
                        </h2>
                        <p className="text-muted-foreground max-w-xl mx-auto">
                            {t("team.desc")}
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                        {teamMembers.map((member, index) => (
                            <motion.div
                                key={index}
                                className="text-center"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary text-xl font-bold">
                                    {member.initials}
                                </div>
                                <h3 className="font-semibold text-foreground">{member.name}</h3>
                                <p className="text-muted-foreground text-sm">{member.role}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20">
                <div className="container">
                    <motion.div
                        className="text-center max-w-2xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-4">
                            {tc("headline")}
                        </h2>
                        <p className="text-muted-foreground mb-8">
                            {tc("description")}
                        </p>
                        <Link href={EXTERNAL_URLS.nexus.register}>
                            <Button size="lg">
                                {tc("button")}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}
