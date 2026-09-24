"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Quote } from "lucide-react"

interface Testimonial {
    id: string
    company: string
    industry: string
}

const testimonials: Testimonial[] = [
    {
        id: "testimonial1",
        company: "TechCorp GmbH",
        industry: "technology",
    },
    {
        id: "testimonial2",
        company: "FinanzPartner AG",
        industry: "finance",
    },
    {
        id: "testimonial3",
        company: "MedHealth Solutions",
        industry: "healthcare",
    },
]

export function TestimonialsSection() {
    const t = useTranslations("testimonials")

    return (
        <section className="w-full py-20 md:py-28 relative overflow-hidden" id="testimonials">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-muted/30 to-background" />

            <div className="container">
                <motion.div
                    className="text-center mb-14"
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

                {/* Testimonials Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={testimonial.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card className="h-full bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg group">
                                <CardContent className="p-6 flex flex-col h-full">
                                    {/* Quote Icon */}
                                    <div className="mb-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                            <Quote className="w-5 h-5 text-primary" />
                                        </div>
                                    </div>

                                    {/* Quote Text */}
                                    <blockquote className="flex-1 mb-6">
                                        <p className="text-muted-foreground italic leading-relaxed">
                                            &ldquo;{t(`${testimonial.id}.quote`)}&rdquo;
                                        </p>
                                    </blockquote>

                                    {/* Author Info */}
                                    <div className="border-t border-border pt-4">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar Placeholder */}
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center">
                                                <span className="text-sm font-semibold text-primary">
                                                    {t(`${testimonial.id}.author`).charAt(0)}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground text-sm">
                                                    {t(`${testimonial.id}.author`)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t(`${testimonial.id}.role`)}, {testimonial.company}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Stats Bar */}
                <motion.div
                    className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    {["customers", "users", "rating", "uptime"].map((stat) => (
                        <div key={stat} className="text-center">
                            <p className="text-3xl md:text-4xl font-bold text-primary mb-1">
                                {t(`stats.${stat}.value`)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {t(`stats.${stat}.label`)}
                            </p>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
