import { notFound } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    ArrowLeft,
    ArrowRight,
    Target,
    Workflow,
    FileInput,
    FileOutput,
    CheckCircle,
    AlertTriangle,
} from "lucide-react"
import { useCases } from "@/content/useCases"

type Props = {
    params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
    return useCases.map((uc) => ({ slug: uc.slug }))
}

export default async function UseCaseDetailPage({ params }: Props) {
    const { locale, slug } = await params
    const loc = locale as "de" | "en" | "es"

    const useCase = useCases.find((uc) => uc.slug === slug)

    if (!useCase) {
        notFound()
    }

    const t = await getTranslations({ locale, namespace: "useCases" })
    const td = await getTranslations({ locale, namespace: "useCases.detail" })

    const categoryLabels: Record<string, string> = {
        finance: t("finance"),
        healthcare: t("healthcare"),
        legal: t("legal"),
        retail: t("retail"),
        industry: t("industry"),
        public: t("public"),
    }

    const sections = useCase.sections[loc]

    return (
        <div className="min-h-screen py-12 md:py-20">
            <div className="container max-w-4xl">
                {/* Back Link */}
                <Link
                    href={`/${locale}/use-cases`}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t("viewAll")}</span>
                </Link>

                {/* Header */}
                <div className="mb-12">
                    <Badge variant="secondary" className="mb-4">
                        {categoryLabels[useCase.category]}
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {useCase.titles[loc]}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        {useCase.summaries[loc]}
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-10">
                    {/* Context */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Target className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground mb-2">
                                        {td("context")}
                                    </h2>
                                    <p className="text-muted-foreground">{sections.context}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Objective */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Target className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground mb-2">
                                        {td("objective")}
                                    </h2>
                                    <p className="text-muted-foreground">{sections.objective}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Workflow */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Workflow className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground mb-2">
                                        {td("workflow")}
                                    </h2>
                                    <div className="text-muted-foreground whitespace-pre-line">
                                        {sections.workflow}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inputs & Outputs */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileInput className="w-5 h-5 text-primary" />
                                    <h3 className="font-semibold text-foreground">{td("inputs")}</h3>
                                </div>
                                <p className="text-muted-foreground text-sm">{sections.inputs}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileOutput className="w-5 h-5 text-primary" />
                                    <h3 className="font-semibold text-foreground">{td("outputs")}</h3>
                                </div>
                                <p className="text-muted-foreground text-sm">{sections.outputs}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Benefits */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-semibold text-foreground">
                                    {td("benefits")}
                                </h2>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                {sections.benefits.map((benefit, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <span className="text-muted-foreground text-sm">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risks */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                <h2 className="text-lg font-semibold text-foreground">
                                    {td("risks")}
                                </h2>
                            </div>
                            <div className="space-y-2">
                                {sections.risks.map((risk, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <span className="text-muted-foreground text-sm">{risk}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Separator className="my-12" />

                {/* CTA */}
                <Separator className="my-12" />

                {/* Footer / Contact Hint - Replaced Demo CTA with Contact Hint */}
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                        {td("ctaHeadline")}
                    </h2>
                    <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                        {td("ctaDescription")}
                    </p>
                    <Link href={`/${locale}/contact`}>
                        <Button size="lg" variant="outline" className="gap-2">
                            {td("ctaButton")}
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
