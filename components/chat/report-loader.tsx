'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ReportLoader() {
    const t = useTranslations('chat');

    return (
        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50 max-w-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t('generatingReport') || 'Generating Report...'}</span>
                <span className="text-[10px] text-muted-foreground">{t('generatingReportDesc') || 'AI is structuring the meeting notes'}</span>
            </div>
        </div>
    );
}
