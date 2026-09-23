'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStackApp, useUser } from '@stackframe/stack';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogIn, Loader2, Building2, Shield, KeyRound } from 'lucide-react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

const createLoginSchema = (t: TranslateFn) =>
  z.object({
    email: z.string().email({ message: t('validation.invalidEmail') }),
    password: z.string().min(8, t('validation.passwordMin', { count: 8 })),
  });

type LoginSchema = ReturnType<typeof createLoginSchema>;
type LoginValues = z.infer<LoginSchema>;

// Google Icon SVG Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const app = useStackApp();
  const user = useUser({ or: 'return-null' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [detectedTeam, setDetectedTeam] = useState<{ slug: string; name: string; ssoType: string } | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // MFA State
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaVerifying, setIsMfaVerifying] = useState(false);
  const [pendingCallbackUrl, setPendingCallbackUrl] = useState<string | null>(null);

  // Enterprise SSO: Detect URL parameters
  const team = searchParams.get('team');
  const saml = searchParams.get('saml');
  const oidc = searchParams.get('oidc');

  useEffect(() => {
    // If user is logged in and not showing MFA dialog, check MFA status
    if (user && !showMfaDialog) {
      checkMfaAndRedirect();
    }
  }, [user, showMfaDialog]);

  // Check MFA status and redirect or show dialog
  const checkMfaAndRedirect = async () => {
    try {
      const res = await fetch('/api/auth/verify-mfa', {
        cache: 'no-store'
      });
      const data = await res.json();

      if (data.mfaRequired && !data.mfaVerified) {
        // Show MFA dialog
        const defaultCallbackUrl = '/chat';
        const callbackUrlParam = searchParams.get('callbackUrl');
        setPendingCallbackUrl(callbackUrlParam?.trim() || defaultCallbackUrl);
        setShowMfaDialog(true);
      } else {
        // No MFA required or already verified, redirect immediately
        router.replace('/chat');
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
      // On error, redirect anyway - user is logged in
      router.replace('/chat');
    }
  };

  // Auto-initiate enterprise SSO if parameter present
  useEffect(() => {
    if (team) {
      handleEnterpriseLogin(team);
    } else if (saml) {
      handleSAMLLogin(saml);
    } else if (oidc) {
      handleOIDCLogin(oidc);
    }
  }, [team, saml, oidc]);

  // Detect team when email changes (debounced)
  const debouncedDetectTeam = useCallback((email: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!email || !email.includes('@')) {
        setDetectedTeam(null);
        return;
      }

      try {
        const response = await fetch('/api/auth/detect-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.team) {
            setDetectedTeam(data.team);
          } else {
            setDetectedTeam(null);
          }
        }
      } catch (error) {
        console.error('Error detecting team:', error);
        setDetectedTeam(null);
      }
    }, 500); // 500ms debounce
  }, []);

  const handleEmailChange = (email: string) => {
    setEmailValue(email);
    debouncedDetectTeam(email);
  };

  // Enterprise SSO login handlers
  const handleEnterpriseLogin = async (teamSlug: string) => {
    setEnterpriseLoading(true);
    try {
      const response = await fetch(`/api/enterprise-auth/${teamSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const data = await response.json();

      if (data.redirectUrl) {
        // SAML: redirect to IdP
        window.location.href = data.redirectUrl;
      } else if (data.authorizationUrl) {
        // OIDC: redirect to IdP
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No redirect URL returned');
      }
    } catch (err) {
      console.error('Enterprise login error:', err);
      toast({
        title: 'SSO Login Failed',
        description: err instanceof Error ? err.message : 'Unable to initiate SSO login',
        variant: 'destructive',
      });
      setEnterpriseLoading(false);
    }
  };

  const handleSAMLLogin = async (teamSlug: string) => {
    setEnterpriseLoading(true);
    try {
      const response = await fetch(`/api/saml/${teamSlug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard' }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate SAML login');
      }

      const data = await response.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      console.error('SAML login error:', err);
      toast({
        title: 'SAML Login Failed',
        description: 'Unable to initiate SAML login',
        variant: 'destructive',
      });
      setEnterpriseLoading(false);
    }
  };

  const handleOIDCLogin = async (teamSlug: string) => {
    setEnterpriseLoading(true);
    try {
      const response = await fetch(`/api/oidc/${teamSlug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard' }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OIDC login');
      }

      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err) {
      console.error('OIDC login error:', err);
      toast({
        title: 'OIDC Login Failed',
        description: 'Unable to initiate OIDC login',
        variant: 'destructive',
      });
      setEnterpriseLoading(false);
    }
  };

  const schema = useMemo(() => createLoginSchema(t), [t]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await app.signInWithOAuth('google');
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast({
        title: t('loginFailed'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      // Intentar login con Stack Auth
      const result = await (app as any).signInWithCredential({
        email: values.email,
        password: values.password,
      });

      console.log('Login successful:', result);

      // Check if MFA is required (sin delay innecesario)
      const mfaRes = await fetch('/api/auth/verify-mfa', {
        cache: 'no-store' // Asegurar que no use cache
      });
      const mfaData = await mfaRes.json();

      if (mfaData.mfaRequired && !mfaData.mfaVerified) {
        // MFA required - show dialog instead of redirecting
        const defaultCallbackUrl = '/chat';
        const callbackUrlParam = searchParams.get('callbackUrl');
        setPendingCallbackUrl(callbackUrlParam?.trim() || defaultCallbackUrl);
        setShowMfaDialog(true);
        setIsSubmitting(false);
        return;
      }

      // No MFA required, proceed with redirect
      toast({
        title: t('loginSuccess'),
        description: t('redirecting'),
      });

      // Redirect immediately to /chat
      const callbackUrlParam = searchParams.get('callbackUrl');
      const callbackUrl = callbackUrlParam?.trim() ? callbackUrlParam : '/chat';
      router.push(callbackUrl);
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: t('loginFailed'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  });

  // Handle MFA code verification
  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast({
        title: t('loginFailed'),
        description: 'Please enter a valid 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setIsMfaVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast({
          title: t('loginFailed'),
          description: data.error || 'Invalid verification code',
          variant: 'destructive',
        });
        setIsMfaVerifying(false);
        return;
      }

      // MFA verified successfully
      toast({
        title: t('loginSuccess'),
        description: t('redirecting'),
      });

      setShowMfaDialog(false);
      // Use router.push for faster navigation
      router.push(pendingCallbackUrl || '/chat');
    } catch (error) {
      console.error('MFA verification error:', error);
      toast({
        title: t('loginFailed'),
        description: 'Verification failed. Please try again.',
        variant: 'destructive',
      });
      setIsMfaVerifying(false);
    }
  };

  // If user is logged in and NOT waiting for MFA, show loader while redirecting
  // But if MFA dialog is open, don't show loader - let the dialog render
  if (user && !showMfaDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  // Show loading state during enterprise SSO redirect
  if (enterpriseLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-slate-500" />
        <p className="text-slate-600 dark:text-slate-400">
          Redirecting to your Identity Provider...
        </p>
      </div>
    );
  }

  // If user is logged in AND MFA dialog is open, show a cleaner MFA-only view
  if (user && showMfaDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mfaCodeInline">Verification Code</Label>
              <Input
                id="mfaCodeInline"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mfaCode.length === 6) {
                    handleMfaVerify();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground text-center">
                Open your authenticator app and enter the code for Nexary
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={handleMfaVerify}
              disabled={isMfaVerifying || mfaCode.length !== 6}
              className="w-full gap-2"
            >
              {isMfaVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Verify & Continue
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => {
                setShowMfaDialog(false);
                setMfaCode('');
                // Sign out and redirect to login
                window.location.href = `/${locale}/login`;
              }}
              disabled={isMfaVerifying}
            >
              Cancel and sign out
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToHome')}
          </Link>
          <LocaleSwitcher className="w-[140px]" />
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <CardTitle className="text-2xl">{t('login')}</CardTitle>
            <CardDescription>{t('loginDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5 mr-2" />
                  {t('continueWithGoogle')}
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                  {t('orDivider')}
                </span>
              </div>
            </div>

            {/* Credential Form */}
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('email')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder={t('emailPlaceholder')}
                          value={emailValue}
                          onChange={(e) => {
                            field.onChange(e);
                            handleEmailChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('password')}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" placeholder={t('passwordPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Enterprise SSO Button - shown when team is detected from email */}
                {detectedTeam && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                    onClick={() => handleEnterpriseLogin(detectedTeam.slug)}
                    disabled={enterpriseLoading || isGoogleLoading}
                  >
                    {enterpriseLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span>Sign in with <strong>{detectedTeam.name}</strong> SSO</span>
                      </span>
                    )}
                  </Button>
                )}

                <Button type="submit" className="w-full h-11" disabled={isSubmitting || isGoogleLoading}>
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('loggingIn')}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn className="h-4 w-4" />
                      {t('loginWithStackAuth')}
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button variant="link" className="text-sm" onClick={() => { window.location.href = `/${locale}/register`; }}>
              {t('noAccountRegister')}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* MFA Verification Dialog */}
      <Dialog open={showMfaDialog} onOpenChange={(open) => {
        if (!open && !isMfaVerifying) {
          // User is trying to close without verification - sign them out
          setShowMfaDialog(false);
          setMfaCode('');
          // Redirect back to login
          window.location.href = `/${locale}/login`;
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to complete sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfaCode">Verification Code</Label>
              <Input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mfaCode.length === 6) {
                    handleMfaVerify();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground text-center">
                Open your authenticator app and enter the code for Nexary
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setShowMfaDialog(false);
                setMfaCode('');
                window.location.href = `/${locale}/login`;
              }}
              disabled={isMfaVerifying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMfaVerify}
              disabled={isMfaVerifying || mfaCode.length !== 6}
              className="gap-2"
            >
              {isMfaVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Verify
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
