"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

export default function DatenschutzPage() {
    const t = useTranslations("legal.privacy")

    const renderSection = (titleKey: string, contentKeys: string[]) => (
        <div className="mb-8 last:mb-0">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-foreground">{t(titleKey)}</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
                {contentKeys.map((key) => (
                    <p key={key}>{t(key)}</p>
                ))}
            </div>
        </div>
    )

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
                        <CardContent className="p-6 md:p-10">
                            <div className="mb-8">
                                <p className="text-muted-foreground leading-relaxed">{t("intro")}</p>
                            </div>

                            {renderSection("controller", [
                                "controller_company",
                                "controller_address",
                                "controller_contact",
                                "controller_representatives",
                                "register_court",
                                "vat_number"
                            ])}

                            {renderSection("dpo", ["dpo_contact"])}

                            {renderSection("legal_bases", [
                                "basis_consent",
                                "basis_contract",
                                "basis_legal",
                                "basis_interest"
                            ])}

                            {renderSection("data_types", ["data_types_desc"])}
                            {renderSection("data_categories", ["data_categories_desc"])}
                            {renderSection("purposes", ["purposes_desc"])}

                            {renderSection("website", [
                                "website_data",
                                "website_legal_basis",
                                "website_purpose",
                                "retention_website"
                            ])}

                            {renderSection("cookies", [
                                "cookies_desc",
                                "cookies_functional",
                                "cookies_marketing",
                                "cookies_storage",
                                "cookies_optout"
                            ])}

                            {renderSection("contact_form", [
                                "contact_form_data",
                                "contact_form_legal_basis",
                                "contact_form_retention"
                            ])}

                            {renderSection("newsletter", [
                                "newsletter_consent",
                                "newsletter_content",
                                "newsletter_double_opt",
                                "newsletter_storage",
                                "newsletter_optout"
                            ])}

                            {renderSection("platform", [
                                "platform_desc",
                                "platform_avp",
                                "platform_processing",
                                "platform_purpose"
                            ])}

                            {renderSection("kai_models", [
                                "kai_openai",
                                "kai_anthropic",
                                "kai_google",
                                "kai_local",
                                "kai_disclaimer"
                            ])}

                            {renderSection("rights", [
                                "right_oppose",
                                "right_consent",
                                "right_info",
                                "right_correct",
                                "right_delete",
                                "right_portability",
                                "right_complaint"
                            ])}

                            {renderSection("authority", [
                                "authority_name",
                                "authority_address",
                                "authority_phone",
                                "authority_fax",
                                "authority_email"
                            ])}

                            {renderSection("security", ["security_desc"])}

                            {renderSection("data_transfers", [
                                "data_transfers_scc",
                                "data_transfers_dpf"
                            ])}

                            {renderSection("data_retention", [
                                "data_retention_desc",
                                "contract_data_retention"
                            ])}

                            <div className="mb-8 last:mb-0">
                                <h2 className="text-xl md:text-2xl font-semibold mb-4 text-foreground">{t("changes")}</h2>
                                <p className="text-muted-foreground leading-relaxed">{t("changes_desc")}</p>
                            </div>

                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
