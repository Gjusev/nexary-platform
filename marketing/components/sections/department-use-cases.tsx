"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Users,
    Monitor,
    Headphones,
    TrendingUp,
    ShoppingCart,
    Lightbulb,
    Megaphone,
    Scale,
    Calculator,
    CheckCircle,
    Sparkles,
} from "lucide-react"

// Departments configuration - data is now loaded from i18n
const departmentsData = {
    hr: {
        icon: Users,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
    },
    it: {
        icon: Monitor,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
    },
    service: {
        icon: Headphones,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
    },
    sales: {
        icon: TrendingUp,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
    },
    marketing: {
        icon: Megaphone,
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
    },
    finance: {
        icon: Calculator,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
    },
    legal: {
        icon: Scale,
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
    },
    purchasing: {
        icon: ShoppingCart,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
    },
    rd: {
        icon: Lightbulb,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
    },
}

const departmentKeys = Object.keys(departmentsData) as (keyof typeof departmentsData)[]

export function DepartmentUseCases() {
    const t = useTranslations("departmentUseCases")

    return (
        <section className="w-full py-20 md:py-32 bg-background" id="department-use-cases">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-4">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {t("badge")}
                    </Badge>
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
                        {t("headline")}
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        {t("subheadline")}
                    </p>
                </motion.div>

                <Tabs defaultValue="marketing" className="w-full max-w-7xl mx-auto">
                    <TabsList className="w-full flex flex-wrap justify-center h-auto gap-2 bg-transparent p-0 mb-12">
                        {departmentKeys.map((deptId) => {
                            const dept = departmentsData[deptId]
                            const IconComponent = dept.icon
                            return (
                                <TabsTrigger
                                    key={deptId}
                                    value={deptId}
                                    className="px-4 py-2.5 rounded-full text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted/50 transition-all border border-transparent data-[state=active]:border-primary/20 flex items-center gap-2"
                                >
                                    <IconComponent className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t(`departments.${deptId}.title`)}</span>
                                </TabsTrigger>
                            )
                        })}
                    </TabsList>

                    {departmentKeys.map((deptId) => {
                        const dept = departmentsData[deptId]
                        const IconComponent = dept.icon
                        return (
                            <TabsContent key={deptId} value={deptId} className="mt-0 focus-visible:outline-none">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    {/* Department Header */}
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 p-6 bg-muted/30 rounded-2xl">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl ${dept.bgColor} flex items-center justify-center`}>
                                                <IconComponent className={`w-7 h-7 ${dept.color}`} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-foreground">
                                                    {t(`departments.${deptId}.title`)}
                                                </h3>
                                                <p className="text-muted-foreground">
                                                    {t(`departments.${deptId}.description`)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-6">
                                            {[0, 1].map((idx) => (
                                                <div key={idx} className="text-center">
                                                    <div className={`text-2xl font-bold ${dept.color}`}>
                                                        {t(`departments.${deptId}.metrics.${idx}.value`)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {t(`departments.${deptId}.metrics.${idx}.label`)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Use Cases Grid */}
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[0, 1, 2, 3, 4, 5].map((index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                            >
                                                <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                                                    <CardContent className="p-5">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-8 h-8 rounded-lg ${dept.bgColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                                                <CheckCircle className={`w-4 h-4 ${dept.color}`} />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                                                                    {t(`departments.${deptId}.useCases.${index}.title`)}
                                                                </h4>
                                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                                    {t(`departments.${deptId}.useCases.${index}.desc`)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            </TabsContent>
                        )
                    })}
                </Tabs>
            </div>
        </section>
    )
}
