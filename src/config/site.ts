import { getRuntimeConfigValue } from './runtimeConfig'

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ja: 'ja-JP',
  zh: 'zh-CN',
}

const locale = getRuntimeConfigValue('VITE_LOCALE') ?? import.meta.env.VITE_LOCALE ?? 'de'
const dateLocale = localeMap[locale] || 'de-DE'
const enableHighlights = import.meta.env.VITE_ENABLE_HIGHLIGHTS !== 'false'

export const siteConfig = {
  siteName: getRuntimeConfigValue('VITE_SITE_NAME') ?? import.meta.env.VITE_SITE_NAME ?? 'BirdNET Dashboard',
  siteTagline: getRuntimeConfigValue('VITE_SITE_TAGLINE') ?? import.meta.env.VITE_SITE_TAGLINE ?? '',
  siteSubtitle: getRuntimeConfigValue('VITE_SITE_SUBTITLE') ?? import.meta.env.VITE_SITE_SUBTITLE ?? 'BirdNET-Go',
  locale,
  dateLocale,
  defaultTheme:
    (getRuntimeConfigValue('VITE_DEFAULT_THEME') ?? import.meta.env.VITE_DEFAULT_THEME ?? 'system') as
      | 'light'
      | 'dark'
      | 'system',
  appVersion: getRuntimeConfigValue('VITE_APP_VERSION') ?? import.meta.env.VITE_APP_VERSION ?? '',
  enableHighlights,
} as const
