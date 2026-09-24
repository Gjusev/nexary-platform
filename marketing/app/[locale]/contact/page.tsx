"use client"

import { useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SubpageHero } from "@/components/sections/subpage-hero"
import { ArrowRight, Mail, Phone, MapPin, MessageSquare } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { EXTERNAL_URLS } from "@/lib/constants"

export default function ContactPage() {
    const t = useTranslations("contact")
    const locale = useLocale()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [privacyAccepted, setPrivacyAccepted] = useState(false)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!privacyAccepted) {
            toast({
                variant: "destructive",
                title: t("form.privacyErrorTitle") || "Fehler",
                description: t("form.privacyError"),
            })
            return
        }

        // Store form reference before async operation
        const form = e.currentTarget

        setIsSubmitting(true)

        // Simulate form submission
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setIsSubmitting(false)

        // Show success toast
        toast({
            title: t("form.successToastTitle") || "Erfolg",
            description: t("form.successDesc"),
        })

        // Reset form
        form.reset()
        setPrivacyAccepted(false)
    }

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <SubpageHero
                tag={t("tagline")}
                tagIcon={MessageSquare}
                headline={t("headline")}
                subheadline={t("subheadline")}
                showCta={false}
            />

            <div className="container py-12">

                <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Card>
                            <CardContent className="p-6 md:p-8">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                                                {t("form.name")} *
                                            </label>
                                            <input
                                                type="text"
                                                id="name"
                                                name="name"
                                                required
                                                className="w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="company" className="block text-sm font-medium text-foreground mb-2">
                                                {t("form.company")}
                                            </label>
                                            <input
                                                type="text"
                                                id="company"
                                                name="company"
                                                className="w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                                                {t("form.email")} *
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                required
                                                className="w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                                                {t("form.message")} *
                                            </label>
                                            <textarea
                                                id="message"
                                                name="message"
                                                rows={5}
                                                required
                                                className="w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                            />
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                id="privacy"
                                                checked={privacyAccepted}
                                                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                                className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                                                required
                                            />
                                            <label htmlFor="privacy" className="text-sm text-muted-foreground leading-relaxed">
                                                {t("form.privacyLabel")}{" "}
                                                <Link
                                                    href={`/${locale}/legal/datenschutz`}
                                                    className="text-primary hover:underline font-medium"
                                                >
                                                    {t("form.privacyLink")}
                                                </Link>
                                                {" "}{t("form.privacyAnd")}{" "}
                                                <Link
                                                    href={`/${locale}/legal/agb`}
                                                    className="text-primary hover:underline font-medium"
                                                >
                                                    {t("form.agbLink")}
                                                </Link>.
                                            </label>
                                        </div>

                                        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                                            {isSubmitting ? t("form.sending") : t("form.submit")}
                                        </Button>
                                    </form>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Contact Info & CTA */}
                    <motion.div
                        className="space-y-8"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {/* Contact Details */}
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="font-semibold text-foreground mb-6">{t("details.headline")}</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Mail className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">{t("details.email")}</p>
                                            <p className="text-foreground">hallo@nexary.de</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Phone className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">{t("details.phone")}</p>
                                            <p className="text-foreground">+49 (0)123 456789</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">{t("details.address")}</p>
                                            <p className="text-foreground">Musterstraße 1, 60000 Frankfurt am Main</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Get Started CTA */}
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="p-6">
                                <h3 className="font-semibold text-foreground mb-2">
                                    {t("cta.headline")}
                                </h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    {t("cta.description")}
                                </p>
                                <Link href={EXTERNAL_URLS.nexus.register}>
                                    <Button>
                                        {t("cta.button")}
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
