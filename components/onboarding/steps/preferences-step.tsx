'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations, useLocale } from 'next-intl';
import { useUser } from '@stackframe/stack';
import { Globe, Cpu, Check } from 'lucide-react';

interface PreferencesStepProps {
    onNext: () => void;
}

export function PreferencesStep({ onNext }: PreferencesStepProps) {
    const t = useTranslations('onboarding.preferences');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const user = useUser({ or: 'return-null' });

    const [selectedLanguage, setSelectedLanguage] = useState(locale);
    const [isSaving, setIsSaving] = useState(false);

    const languages = [
        { code: 'en', label: tCommon('languages.en') },
        { code: 'de', label: tCommon('languages.de') },
        { code: 'es', label: tCommon('languages.es') }
    ];

    const handleNext = async () => {
        setIsSaving(true);
        try {
            // If language changed, save and reload
            if (selectedLanguage !== locale) {
                // Save to clientMetadata
                if (user) {
                    const currentMeta = (user.clientMetadata as any) || {};
                    const currentPrefs = currentMeta.preferences || {};

                    await user.update({
                        clientMetadata: {
                            ...currentMeta,
                            preferences: {
                                ...currentPrefs,
                                language: selectedLanguage
                            }
                        }
                    });
                }

                // Set cookie and reload forcedly
                document.cookie = `NEXT_LOCALE=${selectedLanguage}; path=/; max-age=31536000`;
                window.location.reload();
                // Wait for reload
                return;
            }

            // Proceed if no reload needed
            onNext();
        } catch (error) {
            console.error(error);
            setIsSaving(false);
            onNext(); // Fallback
        }
    };

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto py-4 space-y-8">
            <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <Globe className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="text-muted-foreground">{t('subtitle')}</p>
            </div>

            <div className="space-y-6 bg-card border rounded-xl p-6">
                <div className="space-y-4">
                    <Label className="text-base">{t('languageLabel')}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {languages.map((lang) => (
                            <div
                                key={lang.code}
                                className={`
                                    relative flex items-center justify-between px-4 py-3 rounded-lg border-2 cursor-pointer transition-all
                                    ${selectedLanguage === lang.code
                                        ? 'border-primary bg-primary/5'
                                        : 'border-muted hover:border-primary/50'}
                                `}
                                onClick={() => setSelectedLanguage(lang.code)}
                            >
                                <span className="font-medium">{lang.label}</span>
                                {selectedLanguage === lang.code && (
                                    <div className="h-4 w-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    {t('note')}
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <Button size="lg" onClick={handleNext} disabled={isSaving} className="w-full sm:w-auto min-w-[200px]">
                    {isSaving ? tCommon('loading') : t('continueButton')}
                </Button>
            </div>
        </div>
    );
}
