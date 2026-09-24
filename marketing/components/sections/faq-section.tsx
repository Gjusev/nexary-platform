"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpCircle } from "lucide-react"

export function FAQSection() {
    const t = useTranslations("faq")

    const faqs = [
        {
            question: t("question1"),
            answer: t("answer1"),
        },
        {
            question: t("question2"),
            answer: t("answer2"),
        },
        {
            question: t("question3"),
            answer: t("answer3"),
        },
        {
            question: t("question4"),
            answer: t("answer4"),
        },
    ]

    return (
        <section className="w-full py-20 md:py-28 relative overflow-hidden" id="faq">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
            </div>

            <div className="container">
                <motion.div
                    className="text-center mb-14"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                        <HelpCircle className="w-4 h-4" />
                        {t("headline")}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                <motion.div
                    className="max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
                        <CardContent className="p-0">
                            <Accordion type="single" collapsible className="w-full">
                                {faqs.map((faq, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <AccordionItem
                                            value={`item-${index}`}
                                            className="border-b border-border last:border-b-0 px-6"
                                        >
                                            <AccordionTrigger className="text-left text-base md:text-lg py-5 hover:no-underline group">
                                                <div className="flex items-center gap-4">
                                                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                                        {faq.question}
                                                    </span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="text-muted-foreground pb-5 pl-12">
                                                {faq.answer}
                                            </AccordionContent>
                                        </AccordionItem>
                                    </motion.div>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Contact CTA */}
                <motion.div
                    className="text-center mt-10"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <p className="text-muted-foreground">
                        {t("moreQuestions")}{" "}
                        <a href="#contact" className="text-primary hover:underline font-medium">
                            {t("contactUs")}
                        </a>
                    </p>
                </motion.div>
            </div>
        </section>
    )
}

