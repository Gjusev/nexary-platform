import { redirect } from 'next/navigation';

import { resolveLocale } from '@/lib/i18n/resolve-locale';

export default async function Home() {
  const locale = await resolveLocale();

  redirect(`/${locale}`);
}
