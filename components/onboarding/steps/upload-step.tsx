'use client';

import { useState } from 'react';
import { Upload, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface UploadStepProps {
    onNext: () => void;
}

export function UploadStep({ onNext }: UploadStepProps) {
    const t = useTranslations('onboarding.upload');
    const [uploaded, setUploaded] = useState(false);

    const handleUpload = () => {
        // Simulate upload - in real implementation would integrate with RAG upload
        setUploaded(true);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold">{t('title')}</h2>
                <p className="text-muted-foreground max-w-lg">
                    {t('subtitle')}
                </p>
            </div>

            {/* Upload zone */}
            <div className={`w-full max-w-2xl aspect-[4/3] border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${uploaded
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/50'
                }`}>
                {uploaded ? (
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-green-700 dark:text-green-400">{t('uploaded')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t('exampleDocument')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4">
                        <Upload className="h-16 w-16 mx-auto text-gray-400" />
                        <div>
                            <p className="font-semibold">{t('dragHere')}</p>
                            <p className="text-sm text-muted-foreground">{t('or')}</p>
                        </div>
                        <Button variant="outline" onClick={handleUpload}>
                            <FileText className="mr-2 h-4 w-4" />
                            {t('useExample')}
                        </Button>
                    </div>
                )}
            </div>

            <Button
                size="lg"
                onClick={onNext}
                disabled={!uploaded}
                className="mt-4"
            >
                {t('nextButton')}
            </Button>
        </div>
    );
}
