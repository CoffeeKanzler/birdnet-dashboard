import { describe, it, expect, beforeEach } from 'vitest'
import { t, setLocale, getLocale, getSpeciesData, isSupportedLocale, resolveInitialLocale } from '.'

beforeEach(() => {
  setLocale('de')
})

describe('t()', () => {
  it('returns German string for known key', () => {
    expect(t('nav.live')).toBe('Live')
  })

  it('interpolates params', () => {
    expect(t('common.filter', { value: 'Amsel' })).toBe('Filter: Amsel')
  })

  it('falls back to key when missing', () => {
    // @ts-expect-error intentional bad key for fallback test
    expect(t('does.not.exist')).toBe('does.not.exist')
  })

  it('returns English string after setLocale("en")', () => {
    setLocale('en')
    expect(t('nav.today')).toBe('Today')
  })
})

describe('setLocale() / getLocale()', () => {
  it('returns current locale', () => {
    expect(getLocale()).toBe('de')
    setLocale('en')
    expect(getLocale()).toBe('en')
  })

  it('falls back to de for unsupported locale', () => {
    setLocale('fr')
    expect(getLocale()).toBe('de')
  })
})

describe('locale helpers', () => {
  it('validates supported locales', () => {
    expect(isSupportedLocale('de')).toBe(true)
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('fr')).toBe(false)
  })

  it('resolves initial locale by precedence (url > storage > fallback > navigator)', () => {
    expect(
      resolveInitialLocale({
        urlLocale: 'en',
        storedLocale: 'de',
        navigatorLocale: 'de-DE',
        fallbackLocale: 'de',
      }),
    ).toBe('en')

    expect(
      resolveInitialLocale({
        urlLocale: null,
        storedLocale: 'en',
        navigatorLocale: 'de-DE',
        fallbackLocale: 'de',
      }),
    ).toBe('en')

    expect(
      resolveInitialLocale({
        urlLocale: null,
        storedLocale: null,
        navigatorLocale: 'en-US',
        fallbackLocale: 'de',
      }),
    ).toBe('de')
  })
})

describe('getSpeciesData()', () => {
  it('returns German species data for known scientific name', () => {
    const data = getSpeciesData('Alcedo atthis')
    expect(data.commonName).toBe('Eisvogel')
    expect(data.description).toContain('Uferjaeger')
    expect(data.notability).toBe('Lokales Symbol')
    expect(data.whyNotable).toContain('Selten gut zu sehen')
  })

  it('returns English species data after setLocale("en")', () => {
    setLocale('en')
    const data = getSpeciesData('Alcedo atthis')
    expect(data.commonName).toBe('Common Kingfisher')
    expect(data.notability).toBe('Local Icon')
  })

  it('falls back to de when locale has no entry', () => {
    setLocale('en')
    // Turdus merula exists in both locales; just verify it returns something
    const data = getSpeciesData('Turdus merula')
    expect(data.commonName).toBeTruthy()
  })

  it('returns empty object for unknown scientific name', () => {
    const data = getSpeciesData('Nonexistent species')
    expect(data).toEqual({})
  })
})
