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

const locale = import.meta.env.VITE_LOCALE || 'de'
const dateLocale = localeMap[locale] || 'de-DE'

export const siteConfig = {
  siteName: import.meta.env.VITE_SITE_NAME || 'BirdNET Dashboard',
  siteTagline: import.meta.env.VITE_SITE_TAGLINE || '',
  siteSubtitle: import.meta.env.VITE_SITE_SUBTITLE || 'BirdNET-Go',
  locale,
  dateLocale,
  defaultTheme: (import.meta.env.VITE_DEFAULT_THEME as 'light' | 'dark' | 'system') || 'system',
  appVersion: import.meta.env.VITE_APP_VERSION || '',
} as const
