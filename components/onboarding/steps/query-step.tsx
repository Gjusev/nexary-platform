'use client';

import { useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';

interface QueryStepProps {
    onNext: () => void;
}



export function QueryStep({ onNext }: QueryStepProps) {
    const t = useTranslations('onboarding.query');
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);


    // Actually, to properly translate the array of suggested questions, we should use keys.
    // Let's use hardcoded keys mapped to t() calls for now.

    // Better implementation for suggested questions:
    const suggestedQuestions = [
        t('sampleQuestion1'),
        t('sampleQuestion2'),
        t('sampleQuestion3')
    ];

    const handleAsk = async (question?: string) => {
        const q = question || query;
        if (!q) return;

        setLoading(true);
        setQuery(q);

        // Simulate AI response
        setTimeout(() => {
            setResponse(t('mockResponse'));
            setLoading(false);
        }, 1500);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">{t('title')}</h2>
                <p className="text-muted-foreground">
                    {t('subtitle')}
                </p>
            </div>

            {/* Suggested questions - disabling for now as they are hardcoded, or just show Title */}
            {/* Suggested questions */}
            <div className="space-y-2">
                <p className="text-sm font-medium">{t('suggestedQuestions')}</p>
                <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.map((q, idx) => (
                        <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => handleAsk(q)}
                            disabled={loading}
                        >
                            {q}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Query input */}
            <div className="space-y-2">
                <Textarea
                    placeholder={t('placeholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-[100px]"
                    disabled={loading}
                />
                <Button onClick={() => handleAsk()} disabled={!query || loading} className="w-full">
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('generating')}
                        </>
                    ) : (
                        <>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            {t('askButton')}
                        </>
                    )}
                </Button>
            </div>

            {/* Response */}
            {response && (
                <div className="flex-1 overflow-auto rounded-lg border bg-muted/30 p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {response}
                    </div>
                </div>
            )}

            <Button
                size="lg"
                onClick={onNext}
                disabled={!response}
                className="mt-auto"
            >
                {t('continueButton')}
            </Button>
        </div>
    );
}
