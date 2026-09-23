'use client';

import { Button } from '@/components/ui/button';
import { Play, Sparkles, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface WelcomeStepProps {
    onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
    const t = useTranslations('onboarding.welcome');

    const benefits = [
        t('benefits.chat'),
        t('benefits.rag'),
        t('benefits.templates'),
        t('benefits.sources'),
        t('benefits.dsgvo')
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full space-y-8 text-center">
            <div className="space-y-4">
                <div className="mx-auto w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold">
                    {t('title')}
                </h1>

                <p className="text-lg text-muted-foreground max-w-2xl">
                    {t('subtitle')}
                </p>
            </div>

            {/* Video placeholder */}
            <div className="w-full max-w-xl h-48 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/20 shrink-0">
                <div className="text-center space-y-2">
                    <Play className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">{t('videoPlaceholder')}</p>
                </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-left">
                        <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="text-sm">{benefit}</span>
                    </div>
                ))}
            </div>

            <Button
                size="lg"
                onClick={onNext}
                className="mt-4"
            >
                {t('startButton')}
            </Button>
        </div>
    );
}
