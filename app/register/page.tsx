import { redirect } from 'next/navigation';

import { i18nConfig } from '@/i18n';

export default function RegisterPage() {
  redirect(`/${i18nConfig.defaultLocale}/register`);
}
