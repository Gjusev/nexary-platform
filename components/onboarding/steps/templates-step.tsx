'use client';

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Users, ArrowRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface TemplatesStepProps {
    onNext: () => void;
}

const featuredTemplates = [
    {
        id: 'legal',
        name: 'Legal Assistant',
        description: 'Análisis de contratos y documentos legales',
        icon: '⚖️',
        category: 'legal',
    },
    {
        id: 'financial',
        name: 'Financial Analyst',
        description: 'Análisis financiero y reportes',
        icon: '📊',
        category: 'finance',
    },
    {
        id: 'sales',
        name: 'Sales Copilot',
        description: 'Propuestas comerciales y seguimiento',
        icon: '🛒',
        category: 'sales',
    },
];

export function TemplatesStep({ onNext }: TemplatesStepProps) {
    const t = useTranslations('onboarding.templates');
    const router = useRouter();

    const featuredTemplates = [
        {
            id: 'legal',
            name: t('items.legal.name'),
            description: t('items.legal.description'),
            icon: '⚖️',
            category: 'legal',
        },
        {
            id: 'financial',
            name: t('items.financial.name'),
            description: t('items.financial.description'),
            icon: '📊',
            category: 'finance',
        },
        {
            id: 'sales',
            name: t('items.sales.name'),
            description: t('items.sales.description'),
            icon: '🛒',
            category: 'sales',
        },
    ];

    const samplePrompts = [
        t('prompts.summarize'),
        t('prompts.legal'),
        t('prompts.email')
    ];

    const handleStartChat = () => {
        onNext(); // Complete onboarding
        // Usually onNext just marks complete. We might want to route to /chat if not there.
        // But the wizard is a dialog, so closing it reveals the page.
        // If we want to verify we are on /chat, we could push.
        // For now, closing is enough as the user is likely on /chat or dashboard.
        router.push('/chat');
    };

    const handleExplore = () => {
        onNext();
        setTimeout(() => {
            router.push('/marketplace');
        }, 300);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">{t('title')}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    {t('subtitle')}
                </p>
            </div>

            {/* Featured templates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-shrink-0">
                {featuredTemplates.map((template) => (
                    <Card
                        key={template.id}
                        className="hover:shadow-md transition-shadow cursor-pointer border hover:border-primary/50"
                    >
                        <CardHeader className="p-4">
                            <div className="text-3xl mb-2">{template.icon}</div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <CardDescription className="text-xs line-clamp-2">
                                {template.description}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            {/* Sample Prompts Section */}
            <div className="space-y-3 flex-1 overflow-y-auto min-h-[100px]">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t('samplePromptsTitle')}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {samplePrompts.map((prompt, i) => (
                        <div key={i} className="p-3 bg-muted/50 rounded-lg text-sm border hover:bg-muted transition-colors cursor-pointer" onClick={() => handleStartChat()}>
                            &quot;{prompt}&quot;
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                    onClick={handleStartChat}
                    className="flex-1 bg-primary text-primary-foreground"
                    size="lg"
                >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t('startChat')}
                </Button>

                <Button
                    variant="outline"
                    onClick={handleExplore}
                    className="flex-1"
                >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {t('exploreMarketplace')}
                </Button>
            </div>

            <div className="text-center">
                <Button
                    variant="ghost"
                    onClick={onNext}
                    size="sm"
                    className="text-muted-foreground text-xs"
                >
                    {t('close')}
                </Button>
            </div>
        </div>
    );
}
