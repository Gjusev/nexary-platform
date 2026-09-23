import { getRequestConfig } from 'next-intl/server';
import { i18nConfig } from '../i18n';

import type { AbstractIntlMessages } from 'next-intl';

type Messages = AbstractIntlMessages;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeMessages(base: Messages, overrides: Messages): Messages {
  const result: Messages = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = result[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = mergeMessages(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }

  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = (await requestLocale) ?? i18nConfig.defaultLocale;
  const locale =
    i18nConfig.locales.find((definedLocale) => definedLocale === requested) ??
    i18nConfig.defaultLocale;

  const defaultMessages = (
    await import(`../messages/${i18nConfig.defaultLocale}.json`)
  ).default as Messages;

  if (locale === i18nConfig.defaultLocale) {
    return { locale, messages: defaultMessages };
  }

  let localeMessages: Messages = {};

  try {
    localeMessages = (await import(`../messages/${locale}.json`)).default as Messages;
  } catch (error) {
    console.warn(`[i18n] Missing translation file for locale "${locale}". Falling back to default.`);
  }

  const messages = mergeMessages(defaultMessages, localeMessages);

  return { locale, messages };
});
