'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useStackApp } from '@stackframe/stack';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, Loader2, RefreshCw } from 'lucide-react';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default function VerifyEmailPage() {
    const t = useTranslations('verifyEmail');
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    // Use or: 'return-null' instead of 'redirect' to avoid redirect loops
    const user = useUser({ or: 'return-null' });
    const app = useStackApp();
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!user && !isRedirecting) {
            setIsRedirecting(true);
            router.replace(`/${locale}/login`);
        }
    }, [user, isRedirecting, router, locale]);

    // Check if email is already verified and redirect
    useEffect(() => {
        if (!user) return;

        // Debug: Log all user properties
        const debugData = {
            primaryEmail: user.primaryEmail,
            primaryEmailVerified: user.primaryEmailVerified,
            clientMetadata: user.clientMetadata,
        };
        console.log('🔍 [Verify Email Debug] User data:', debugData);
        setDebugInfo(debugData);

        // Check BOTH properties to be more lenient
        const clientEmailVerified = user.primaryEmailVerified;

        // If either property indicates email is verified, allow access
        if (clientEmailVerified === true && !isRedirecting) {
            console.log('✅ [Verify Email] Email is verified, redirecting...');
            const callbackUrl = searchParams.get('callbackUrl') || '/chat';
            setIsRedirecting(true);
            router.replace(callbackUrl);
        } else {
            console.log('⚠️ [Verify Email] Email not verified yet:', {
                clientEmailVerified,
            });
        }
    }, [user, isRedirecting, router, searchParams]);

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleResendEmail = async () => {
        setIsResending(true);
        try {
            await user?.sendVerificationEmail();
            toast({
                title: t('emailSent'),
                description: t('checkInbox'),
            });
            setResendCooldown(60); // 60 second cooldown
        } catch (error) {
            console.error('Error resending verification email:', error);
            toast({
                title: t('error'),
                description: error instanceof Error ? error.message : t('tryAgain'),
                variant: 'destructive',
            });
        } finally {
            setIsResending(false);
        }
    };

    const handleSignOut = async () => {
        await app.signOut();
        router.replace(`/${locale}/login`);
    };

    const handleContinueAnyway = () => {
        const callbackUrl = searchParams.get('callbackUrl') || '/chat';
        router.replace(callbackUrl);
    };

    // Show loading while checking auth status
    if (!user || isRedirecting) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
        );
    }

    // Check verification status
    const clientEmailVerified = user.primaryEmailVerified;
    const isVerified = clientEmailVerified === true;

    if (isVerified) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 flex items-center justify-between gap-3">
                    <button
                        onClick={handleSignOut}
                        className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('signOut')}
                    </button>
                    <LocaleSwitcher className="w-[140px]" />
                </div>

                <Card className="border-2 shadow-xl">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <Mail className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <CardTitle className="text-2xl">{t('title')}</CardTitle>
                        <CardDescription className="text-base">
                            {t('description', { email: user.primaryEmail || '' })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {user.primaryEmail}
                            </p>
                        </div>

                        {/* Debug info - show in development */}
                        {process.env.NODE_ENV === 'development' && debugInfo && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-left">
                                <p className="font-semibold mb-1">Debug Info:</p>
                                <p>primaryEmailVerified: {String(clientEmailVerified)}</p>
                            </div>
                        )}

                        <Button
                            onClick={handleResendEmail}
                            variant="outline"
                            className="w-full"
                            disabled={isResending || resendCooldown > 0}
                        >
                            {isResending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {resendCooldown > 0
                                ? t('resendIn', { seconds: resendCooldown })
                                : t('resendEmail')}
                        </Button>

                        {/* Emergency button to skip verification */}
                        <Button
                            onClick={handleContinueAnyway}
                            variant="ghost"
                            className="w-full text-sm text-slate-500"
                        >
                            Continue anyway (Debug)
                        </Button>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
                        <p>{t('checkSpam')}</p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
