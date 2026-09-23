import React from 'react';
import { headers } from 'next/headers';
import { authRateLimiter } from '@/lib/rate-limit';
import { getTranslations } from 'next-intl/server';

export default async function RegisterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';

    // 10 requests per minute
    const { success } = await authRateLimiter.check(ip, 10);

    if (!success) {
        const t = await getTranslations('auth');
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">{t('rateLimitExceeded')}</h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        {t('rateLimitMessage')}
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
