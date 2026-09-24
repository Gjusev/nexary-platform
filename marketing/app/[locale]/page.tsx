import { HeroSection } from "@/components/sections/hero-section"
import { SocialProof } from "@/components/sections/social-proof"
import { ProblemSection } from "@/components/sections/problem-section"
import { SolutionSection } from "@/components/sections/solution-section"
import { FeatureShowcase } from "@/components/sections/feature-showcase"
import { ExtendedFeaturesSection } from "@/components/sections/extended-features-section"
import { ModelSelectionSection } from "@/components/sections/model-selection"
import { SecuritySection } from "@/components/sections/security-section"
import { IntegrationsSection } from "@/components/sections/integrations-section"
import { HowItWorksSection } from "@/components/sections/how-it-works"
import { VideoShowcase } from "@/components/sections/video-showcase"
import { DepartmentUseCases } from "@/components/sections/department-use-cases"
import { UseCasesPreview } from "@/components/sections/use-cases-preview"
import { PricingSection } from "@/components/sections/pricing-section"
import { TestimonialsSection } from "@/components/sections/testimonials-section"
import { FAQSection } from "@/components/sections/faq-section"
import { CTASection } from "@/components/sections/cta-section"

export default function HomePage() {
    return (
        <>
            <HeroSection />
            <SocialProof />
            <ProblemSection />
            <SolutionSection />
            <FeatureShowcase />
            <ExtendedFeaturesSection />
            <ModelSelectionSection />
            <SecuritySection />
            <IntegrationsSection />
            <HowItWorksSection />
            <VideoShowcase />
            <DepartmentUseCases />
            <UseCasesPreview />
            <PricingSection />
            <TestimonialsSection />
            <FAQSection />
            <CTASection />
        </>
    )
}

