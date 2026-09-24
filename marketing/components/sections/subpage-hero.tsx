"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { LucideIcon } from "lucide-react"

interface SubpageHeroProps {
    tag: string
    tagIcon?: LucideIcon
    headline: string
    subheadline: string
    ctaText?: string
    ctaHref?: string
    showCta?: boolean
    children?: React.ReactNode
}

export function SubpageHero({
    tag,
    tagIcon: TagIcon,
    headline,
    subheadline,
    ctaText,
    ctaHref = "/contact",
    showCta = true,
    children,
}: SubpageHeroProps) {
    return (
        <section className="relative w-full pt-24 pb-16 md:pt-32 md:pb-20 bg-gradient-to-b from-muted/50 to-background overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
            </div>

            <div className="container relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Column - Text Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-xl"
                    >
                        {/* Tag/Badge */}
                        <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm">
                            {TagIcon && <TagIcon className="w-4 h-4 mr-2" />}
                            {tag}
                        </Badge>

                        {/* Main Heading */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
                            {headline}
                        </h1>

                        {/* Subtext */}
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                            {subheadline}
                        </p>

                        {/* CTA Button */}
                        {showCta && ctaText && (
                            <Button size="lg" asChild>
                                <a href={ctaHref}>
                                    {ctaText}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </a>
                            </Button>
                        )}
                    </motion.div>

                    {/* Right Column - Visual Element */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="hidden lg:flex items-center justify-center"
                    >
                        {children ? (
                            children
                        ) : (
                            /* Default Abstract Graphic */
                            <div className="relative w-full max-w-md aspect-square">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full animate-pulse" />
                                <div className="absolute inset-8 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full" />
                                <div className="absolute inset-16 bg-gradient-to-br from-primary/40 to-primary/20 rounded-full flex items-center justify-center">
                                    <div className="w-24 h-24 bg-primary/50 rounded-2xl flex items-center justify-center shadow-lg">
                                        {TagIcon && <TagIcon className="w-12 h-12 text-primary-foreground" />}
                                    </div>
                                </div>
                                {/* Floating Elements */}
                                <div className="absolute top-4 right-4 w-12 h-12 bg-background border rounded-xl shadow-lg flex items-center justify-center animate-bounce">
                                    <div className="w-6 h-6 bg-primary/20 rounded-lg" />
                                </div>
                                <div className="absolute bottom-8 left-4 w-10 h-10 bg-background border rounded-xl shadow-lg flex items-center justify-center animate-bounce delay-500">
                                    <div className="w-5 h-5 bg-primary/30 rounded-lg" />
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
