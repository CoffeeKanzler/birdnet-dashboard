import de from './locales/de.json'
import en from './locales/en.json'
import deSpecies from './species/de.json'
import enSpecies from './species/en.json'

type TranslationKey = keyof typeof de
export const SUPPORTED_LOCALES = ['de', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

type SpeciesData = {
  commonName?: string
  description?: string
  notability?: string
  whyNotable?: string[]
}

const locales: Record<string, Record<string, string>> = { de, en }
const speciesLocales: Record<string, Record<string, SpeciesData>> = { de: deSpecies, en: enSpecies }

let currentLocale: SupportedLocale = 'de'

const normalizeLocale = (locale: string | null | undefined): SupportedLocale | null => {
  if (!locale) {
    return null
  }

  const normalized = locale.toLowerCase().split('-')[0]
  if (SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale
  }

  return null
}

export function isSupportedLocale(locale: string | null | undefined): locale is SupportedLocale {
  return normalizeLocale(locale) !== null
}

export function resolveInitialLocale(options: {
  urlLocale?: string | null
  storedLocale?: string | null
  navigatorLocale?: string | null
  fallbackLocale?: string | null
}): SupportedLocale {
  const fromUrl = normalizeLocale(options.urlLocale)
  if (fromUrl) {
    return fromUrl
  }

  const fromStorage = normalizeLocale(options.storedLocale)
  if (fromStorage) {
    return fromStorage
  }

  const fromFallback = normalizeLocale(options.fallbackLocale)
  if (fromFallback) {
    return fromFallback
  }

  const fromNavigator = normalizeLocale(options.navigatorLocale)
  if (fromNavigator) {
    return fromNavigator
  }

  return 'de'
}

export function setLocale(locale: string): SupportedLocale {
  currentLocale = normalizeLocale(locale) ?? 'de'
  return currentLocale
}

export function getLocale(): SupportedLocale {
  return currentLocale
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translations = locales[currentLocale] || locales['de']
  let value = translations[key] || locales['de'][key] || key

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.split(`{${paramKey}}`).join(String(paramValue))
    }
  }

  return value
}

export function getSpeciesData(scientificName: string): SpeciesData {
  const locale = speciesLocales[currentLocale] || speciesLocales['de']
  return locale[scientificName] || speciesLocales['de'][scientificName] || {}
}

export function getLocalizedCommonName(commonName: string, scientificName?: string): string {
  const localeData = getSpeciesData(scientificName ?? '')
  const localized = localeData.commonName?.trim()
  if (localized) {
    return localized
  }

  // In English mode, avoid falling back to backend-localized common names
  // (often German) when no curated English mapping is available.
  if (currentLocale === 'en' && scientificName?.trim()) {
    return scientificName.trim()
  }

  return commonName
}
