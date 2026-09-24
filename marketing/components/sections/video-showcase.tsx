"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react"
import { EXTERNAL_URLS } from "@/lib/constants"

export function VideoShowcase() {
    const t = useTranslations("videoShowcase")
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(true)

    return (
        <section className="w-full py-20 md:py-28 relative overflow-hidden" id="video-showcase">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
            </div>

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

                {/* Video Container */}
                <motion.div
                    className="max-w-4xl mx-auto"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border">
                        <CardContent className="p-0">
                            {/* Video Player Container */}
                            <div className="relative aspect-video bg-muted group">
                                {/* Placeholder / Thumbnail */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30 cursor-pointer hover:scale-110 transition-transform">
                                            <Play className="w-8 h-8 text-primary-foreground ml-1" />
                                        </div>
                                        <p className="text-muted-foreground">{t("watchDemo")}</p>
                                    </div>
                                </div>

                                {/* Video Controls Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setIsPlaying(!isPlaying)}
                                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                                            >
                                                {isPlaying ? (
                                                    <Pause className="w-4 h-4 text-white" />
                                                ) : (
                                                    <Play className="w-4 h-4 text-white ml-0.5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setIsMuted(!isMuted)}
                                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                                            >
                                                {isMuted ? (
                                                    <VolumeX className="w-4 h-4 text-white" />
                                                ) : (
                                                    <Volume2 className="w-4 h-4 text-white" />
                                                )}
                                            </button>
                                        </div>
                                        <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                                            <Maximize className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Feature Highlights */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-10"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    {["feature1", "feature2", "feature3"].map((feature, index) => (
                        <div key={feature} className="text-center">
                            <motion.div
                                className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.4 + index * 0.1, type: "spring" }}
                            >
                                <span className="text-lg font-bold text-primary">{index + 1}</span>
                            </motion.div>
                            <h3 className="font-semibold text-foreground mb-1">
                                {t(`${feature}.title`)}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t(`${feature}.description`)}
                            </p>
                        </div>
                    ))}
                </motion.div>

                {/* CTA */}
                <motion.div
                    className="text-center mt-10"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                >
                    <Link href={EXTERNAL_URLS.nexus.register}>
                        <Button size="lg" className="font-semibold">
                            {t("cta")}
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
