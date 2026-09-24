"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

interface Integration {
    name: string
    category: string
    icon: string
    comingSoon?: boolean
}

const integrations: Integration[] = [
    { name: "Microsoft 365", category: "Microsoft", icon: "/icons/integrations/microsoft365.svg" },
    { name: "SharePoint", category: "Microsoft", icon: "/icons/integrations/sharepoint.svg" },
    { name: "Teams", category: "Microsoft", icon: "/icons/integrations/teams.svg" },
    { name: "Slack", category: "Communication", icon: "/icons/integrations/slack.svg" },
    { name: "Notion", category: "Productivity", icon: "/icons/integrations/notion.svg" },
    { name: "Confluence", category: "Atlassian", icon: "/icons/integrations/confluence.svg" },
    { name: "Jira", category: "Atlassian", icon: "/icons/integrations/jira.svg" },
    { name: "Salesforce", category: "CRM", icon: "/icons/integrations/salesforce.svg" },
    { name: "SAP", category: "ERP", icon: "/icons/integrations/sap.svg" },
    { name: "ServiceNow", category: "ITSM", icon: "/icons/integrations/servicenow.svg" },
    { name: "PostgreSQL", category: "Database", icon: "/icons/integrations/postgresql.svg" },
    { name: "REST API", category: "Custom", icon: "/icons/integrations/restapi.svg" },
]

const categoryColors: Record<string, string> = {
    Microsoft: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    Communication: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    Productivity: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
    Atlassian: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    CRM: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    ERP: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    ITSM: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    Database: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    Custom: "bg-primary/10 text-primary border-primary/20",
}

export function IntegrationsSection() {
    const t = useTranslations("integrations")

    return (
        <section className="w-full py-20 md:py-28 bg-muted/30" id="integrations">
            <div className="container">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-4">
                        {t("badge")}
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {t("headline")}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {t("subheadline")}
                    </p>
                </motion.div>

                <motion.div
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    {integrations.map((integration, index) => (
                        <motion.div
                            key={integration.name}
                            className="relative flex flex-col items-center justify-center p-5 md:p-6 rounded-2xl bg-card border hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 cursor-default group"
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                            {/* Coming Soon Badge */}
                            {integration.comingSoon && (
                                <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                        Soon
                                    </Badge>
                                </div>
                            )}

                            {/* Icon */}
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-3 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300">
                                <Image
                                    src={integration.icon}
                                    alt={integration.name}
                                    width={32}
                                    height={32}
                                    className="w-8 h-8"
                                />
                            </div>

                            {/* Name */}
                            <span className="text-sm font-medium text-foreground text-center mb-2">
                                {integration.name}
                            </span>

                            {/* Category Badge */}
                            <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0 border ${categoryColors[integration.category] || categoryColors.Custom}`}
                            >
                                {integration.category}
                            </Badge>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Additional CTA */}
                <motion.p
                    className="text-center text-muted-foreground mt-10"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    {t("customIntegration")}{" "}
                    <a href="#contact" className="text-primary hover:underline font-medium">
                        {t("contactUs")}
                    </a>
                </motion.p>
            </div>
        </section>
    )
}
