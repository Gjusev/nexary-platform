'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser, useStackApp } from '@stackframe/stack';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { LocaleSwitcher } from '@/components/locale-switcher';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

const createPasswordSchema = (t: TranslateFn) =>
  z
    .string()
    .min(12, t('validation.password.minLength', { count: 12 }))
    .regex(/[A-Z]/, t('validation.password.uppercase'))
    .regex(/[a-z]/, t('validation.password.lowercase'))
    .regex(/[0-9]/, t('validation.password.number'));

const createRegisterSchema = (t: TranslateFn) =>
  z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('create'),
      name: z.string().min(3, t('validation.nameMin', { count: 3 })),
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: createPasswordSchema(t),
      teamName: z.string().min(3, t('validation.teamNameMin', { count: 3 })),
      notes: z
        .string()
        .max(280, t('validation.notesMax', { count: 280 }))
        .optional(),
    }),
    z.object({
      mode: z.literal('join-request'),
      name: z.string().min(3, t('validation.nameMin', { count: 3 })),
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: createPasswordSchema(t),
      teamSlug: z.string().min(3, t('validation.teamSlugMin', { count: 3 })),
      message: z
        .string()
        .max(500, t('validation.messageMax', { count: 500 }))
        .optional(),
    }),
    z.object({
      mode: z.literal('join'),
      name: z.string().min(3, t('validation.nameMin', { count: 3 })),
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: createPasswordSchema(t),
      teamName: z.string().min(3, t('validation.teamNameMin', { count: 3 })),
      inviteCode: z
        .string()
        .min(6, t('validation.inviteCodeMin', { count: 6 })),
      notes: z
        .string()
        .max(280, t('validation.notesMax', { count: 280 }))
        .optional(),
    }),
    z.object({
      mode: z.literal('join-link'),
      name: z.string().min(3, t('validation.nameMin', { count: 3 })),
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: createPasswordSchema(t),
      inviteToken: z.string().min(1, t('validation.inviteTokenRequired')),
      teamSlug: z.string().min(1, t('validation.teamSlugRequired')),
    }),
  ]);

type RegisterSchema = ReturnType<typeof createRegisterSchema>;
type FormValues = z.infer<RegisterSchema>;

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

function RegisterPageContent() {
  const t = useTranslations('register');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const user = useUser({ or: 'return-null' });
  const app = useStackApp();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const schema = useMemo(() => createRegisterSchema(t), [t]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'create',
      name: '',
      email: '',
      password: '',
      teamName: '',
      notes: '',
    } as FormValues,
  });

  const mode = useWatch({ control: form.control, name: 'mode' });
  const [isInviteLink, setIsInviteLink] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace('/chat');
    }
  }, [user, router, locale]);

  useEffect(() => {
    const inviteLink = searchParams.get('inviteLink');
    const teamSlug = searchParams.get('teamSlug');

    if (inviteLink && teamSlug) {
      setIsInviteLink(true);
      form.setValue('mode', 'join-link');
      form.setValue('inviteToken', inviteLink);
      form.setValue('teamSlug', teamSlug);
    }
  }, [searchParams, form]);

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      await app.signInWithOAuth('google');
    } catch (error) {
      console.error('Google sign-up error:', error);
      toast({
        title: t('toast.errorTitle'),
        description: error instanceof Error ? error.message : t('toast.errorDescriptionDefault'),
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await fetch('/api/auth/register-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || t('toast.errorDescriptionDefault'));
      }

      toast({
        title: t('toast.successTitle'),
        description: data.message ?? t('toast.successDescription'),
      });
      router.push(`/${locale}/login`);
    } catch (error) {
      toast({
        title: t('toast.errorTitle'),
        description:
          error instanceof Error && error.message
            ? error.message
            : t('toast.errorDescriptionDefault'),
        variant: 'destructive',
      });
    }
  });

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToLogin')}
          </Link>
          <LocaleSwitcher className="w-[150px]" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-2 shadow-xl">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Users className="h-6 w-6 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{t('card.title')}</CardTitle>
                  <CardDescription>{t('card.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Google OAuth Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600"
                onClick={handleGoogleSignUp}
                disabled={isGoogleLoading || form.formState.isSubmitting}
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <GoogleIcon className="h-5 w-5 mr-2" />
                    {t('signUpWithGoogle')}
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

              {isInviteLink ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    {t('inviteLink.title')}
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    {t('inviteLink.description')}
                  </p>
                </div>
              ) : null}

              <Tabs value={mode} onValueChange={(value) => form.setValue('mode', value as FormValues['mode'])}>
                {!isInviteLink && (
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="create">{t('tabs.create')}</TabsTrigger>
                    <TabsTrigger value="join-request">{t('tabs.joinRequest')}</TabsTrigger>
                  </TabsList>
                )}

                <Form {...form}>
                  <form onSubmit={onSubmit} className="space-y-4 mt-6">
                    <input type="hidden" value={mode} {...form.register('mode')} />
                    <input type="hidden" {...form.register('inviteToken')} />
                    <input type="hidden" {...form.register('inviteCode')} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('fields.name.label')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('fields.name.placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('fields.email.label')}</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder={t('fields.email.placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.password.label')}</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder={t('fields.password.placeholder')} {...field} />
                          </FormControl>
                          <FormDescription>{t('fields.password.description')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!isInviteLink && (
                      <>
                        <TabsContent value="create">
                          <FormField
                            control={form.control}
                            name="teamName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('fields.teamName.label')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('fields.teamName.placeholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        <TabsContent value="join-request">
                          <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name="teamSlug"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('fields.teamSlug.label')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('fields.teamSlug.placeholder')} {...field} />
                                  </FormControl>
                                  <FormDescription>{t('fields.teamSlug.description')}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="message"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('fields.message.label')}</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder={t('fields.message.placeholder')}
                                      className="resize-none"
                                      rows={3}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>{t('fields.message.description')}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>
                      </>
                    )}

                    {!isInviteLink && mode === 'create' && (
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('fields.notes.label')}</FormLabel>
                            <FormControl>
                              <Textarea rows={3} placeholder={t('fields.notes.placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <Button type="submit" className="w-full h-11" disabled={form.formState.isSubmitting || isGoogleLoading}>
                      {form.formState.isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('buttons.submitting')}
                        </span>
                      ) : isInviteLink ? (
                        t('buttons.joinViaInvite')
                      ) : mode === 'create' ? (
                        t('buttons.createTeam')
                      ) : mode === 'join-request' ? (
                        t('buttons.sendRequest')
                      ) : (
                        t('buttons.joinWithCode')
                      )}
                    </Button>
                  </form>
                </Form>
              </Tabs>
            </CardContent>
            <CardFooter className="text-xs text-slate-500 dark:text-slate-400">
              {t('card.footer')}
            </CardFooter>
          </Card>

          <Card className="border-2 h-full">
            <CardHeader>
              <CardTitle>{t('tips.title')}</CardTitle>
              <CardDescription>{t('tips.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>{t('tips.item1')}</p>
              <p>{t('tips.item2')}</p>
              <p>{t('tips.item3')}</p>
            </CardContent>
            <CardFooter>
              <Badge variant="secondary">{t('tips.badge')}</Badge>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const t = useTranslations('register');

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('loading')}</span>
            </CardContent>
          </Card>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
