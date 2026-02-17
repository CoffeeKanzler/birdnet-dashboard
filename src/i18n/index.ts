import de from './locales/de.json'
import en from './locales/en.json'
import deSpecies from './species/de.json'
import enSpecies from './species/en.json'

type TranslationKey = keyof typeof de

export type SpeciesData = {
  commonName?: string
  description?: string
  notability?: string
  whyNotable?: string[]
}

const locales: Record<string, Record<string, string>> = { de, en }
const speciesLocales: Record<string, Record<string, SpeciesData>> = { de: deSpecies, en: enSpecies }

let currentLocale = 'de'

export function setLocale(locale: string) {
  currentLocale = locale
}

export function getLocale(): string {
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
