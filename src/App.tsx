import { useCallback, useEffect, useRef, useState } from 'react'

import { getPhotoAttributionRecords } from './api/birdImages'
import ErrorBoundary from './components/ErrorBoundary'
import { siteConfig } from './config/site'
import { getLocale, isSupportedLocale, setLocale, t, type SupportedLocale } from './i18n'
import DetectionsView from './features/detections/DetectionsView'
import { useBackgroundCacheWarmer } from './features/detections/useBackgroundCacheWarmer'
import LandingView from './features/landing/LandingView'
import RarityView from './features/rarity/RarityView'
import SpeciesDetailView from './features/species/SpeciesDetailView'
import StatisticsView from './features/statistics/StatisticsView'

type MainView = 'landing' | 'today' | 'archive' | 'rarity' | 'stats'
type AppView = MainView | 'species'

type SelectedSpecies = {
  commonName: string
  scientificName: string
}

type AppRouteState = {
  view: AppView
  lastMainView: 'today' | 'archive' | 'rarity' | 'stats'
  selectedSpecies: SelectedSpecies | null
}

type ThemeMode = 'light' | 'dark'
type NavItem = {
  view: MainView
  label: string
}

const THEME_STORAGE_KEY = 'birdnet-showoff-theme'
const LOCALE_STORAGE_KEY = 'birdnet-showoff-locale'
const HIGHLIGHTS_ENABLED = siteConfig.enableHighlights

const getRouteLocale = (): SupportedLocale | null => {
  const locale = new URLSearchParams(window.location.search).get('lang')
  return isSupportedLocale(locale) ? locale : null
}

const getInitialTheme = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    // no-op (storage may be unavailable in restricted contexts)
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const parseRouteState = (): AppRouteState => {
  const params = new URLSearchParams(window.location.search)
  const routeView = params.get('view')

  if (routeView === 'species') {
    const commonName = params.get('common')?.trim() ?? ''
    const scientificName = params.get('scientific')?.trim() ?? ''
    const from = params.get('from')
    const requestedFrom =
      from === 'today' || from === 'archive' || from === 'rarity' || from === 'stats' ? from : 'today'
    const lastMainView = !HIGHLIGHTS_ENABLED && requestedFrom === 'rarity' ? 'today' : requestedFrom

    if (scientificName) {
      return {
        view: 'species',
        lastMainView,
        selectedSpecies: { commonName: commonName || scientificName, scientificName },
      }
    }
  }

  if (routeView === 'today' || routeView === 'archive' || routeView === 'rarity' || routeView === 'stats') {
    const normalizedView = !HIGHLIGHTS_ENABLED && routeView === 'rarity' ? 'today' : routeView
    return {
      view: normalizedView,
      lastMainView: normalizedView,
      selectedSpecies: null,
    }
  }

  return {
    view: 'landing',
    lastMainView: 'today',
    selectedSpecies: null,
  }
}

const createRoute = (state: AppRouteState, locale: SupportedLocale, includeLocaleInRoute: boolean): string => {
  const params = new URLSearchParams()

  if (state.view === 'species' && state.selectedSpecies) {
    params.set('view', 'species')
    params.set('from', state.lastMainView)
    params.set('scientific', state.selectedSpecies.scientificName)
  } else {
    params.set('view', state.view)
  }

  if (includeLocaleInRoute) {
    params.set('lang', locale)
  }

  const query = params.toString()
  return query ? `?${query}` : window.location.pathname
}

const App = () => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => getLocale())
  const [includeLocaleInRoute, setIncludeLocaleInRoute] = useState<boolean>(() => getRouteLocale() !== null)
  const [initialState] = useState<AppRouteState>(() => parseRouteState())
  const [view, setView] = useState<AppView>(initialState.view)
  const [lastMainView, setLastMainView] = useState<'today' | 'archive' | 'rarity' | 'stats'>(
    initialState.lastMainView,
  )
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies | null>(
    initialState.selectedSpecies,
  )
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [isHeaderCondensed, setIsHeaderCondensed] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isAttributionOpen, setIsAttributionOpen] = useState(false)
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)
  const [, setAttributionVersion] = useState(0)
  const attributionDialogRef = useRef<HTMLDivElement | null>(null)
  const attributionCloseRef = useRef<HTMLButtonElement | null>(null)
  const creditsDialogRef = useRef<HTMLDivElement | null>(null)
  const creditsCloseRef = useRef<HTMLButtonElement | null>(null)

  useBackgroundCacheWarmer(view === 'landing' || view === 'today')

  const allNavItems: NavItem[] = [
    { view: 'landing', label: t('nav.live') },
    { view: 'today', label: t('nav.today') },
    { view: 'archive', label: t('nav.archive') },
    { view: 'rarity', label: t('nav.highlights') },
    { view: 'stats', label: t('nav.stats') },
  ]
  const navItems: NavItem[] = allNavItems.filter((item) => HIGHLIGHTS_ENABLED || item.view !== 'rarity')

  const updateHistory = useCallback((state: AppRouteState, mode: 'push' | 'replace') => {
    const nextUrl = createRoute(state, locale, includeLocaleInRoute)
    if (mode === 'push') {
      window.history.pushState(null, '', nextUrl)
      return
    }

    window.history.replaceState(null, '', nextUrl)
  }, [includeLocaleInRoute, locale])

  useEffect(() => {
    updateHistory(initialState, 'replace')
  }, [initialState, updateHistory])

  useEffect(() => {
    const onAttributionUpdate = () => {
      setAttributionVersion((value) => value + 1)
    }

    window.addEventListener('birdnet-attribution-updated', onAttributionUpdate)
    return () => {
      window.removeEventListener('birdnet-attribution-updated', onAttributionUpdate)
    }
  }, [])

  const attributionRecords = getPhotoAttributionRecords()

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // no-op (storage may be unavailable in restricted contexts)
    }
  }, [locale])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // no-op (storage may be unavailable in restricted contexts)
    }
  }, [theme])

  useEffect(() => {
    const handlePopState = () => {
      const next = parseRouteState()
      setView(next.view)
      setLastMainView(next.lastMainView)
      setSelectedSpecies(next.selectedSpecies)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setShowScrollTop(y > 300)
      setIsHeaderCondensed((current) => {
        if (current) {
          return y > 24
        }

        return y > 72
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleViewChange = (nextView: MainView) => {
    setView(nextView)

    const nextLastMainView =
      nextView === 'today' || nextView === 'archive' || nextView === 'rarity' || nextView === 'stats'
        ? nextView
        : lastMainView

    if (nextView === 'today' || nextView === 'archive' || nextView === 'rarity' || nextView === 'stats') {
      setLastMainView(nextView)
    }

    setSelectedSpecies(null)
    updateHistory(
      {
        view: nextView,
        lastMainView: nextLastMainView,
        selectedSpecies: null,
      },
      'push',
    )
    window.scrollTo({ top: 0 })
  }

  const handleSpeciesSelect = (species: SelectedSpecies) => {
    const sourceView =
      view === 'today' || view === 'archive' || view === 'rarity' || view === 'stats'
        ? view
        : lastMainView

    setLastMainView(sourceView)

    setSelectedSpecies(species)
    setView('species')
    updateHistory(
      {
        view: 'species',
        lastMainView: sourceView,
        selectedSpecies: species,
      },
      'push',
    )
    window.scrollTo({ top: 0 })
  }

  const handleSpeciesBack = () => {
    setView(lastMainView)
    setSelectedSpecies(null)
    updateHistory(
      {
        view: lastMainView,
        lastMainView,
        selectedSpecies: null,
      },
      'push',
    )
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (!isAttributionOpen && !isCreditsOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isAttributionOpen, isCreditsOpen])

  useEffect(() => {
    if (!isAttributionOpen) {
      return
    }

    attributionCloseRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsAttributionOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = attributionDialogRef.current
      if (!dialog) {
        return
      }

      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )

      if (focusables.length === 0) {
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAttributionOpen])

  useEffect(() => {
    if (!isCreditsOpen) {
      return
    }

    creditsCloseRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsCreditsOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = creditsDialogRef.current
      if (!dialog) {
        return
      }

      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )

      if (focusables.length === 0) {
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isCreditsOpen])

  const activeNavigationView = view
  const openAttribution = () => {
    setIsAttributionOpen(true)
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
        href="#main-content"
      >
        {t('common.skipToContent')}
      </a>
      <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 sm:pt-4">
        <div
          className={`mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 shadow-sm backdrop-blur transition-all dark:border-slate-700 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between ${
            isHeaderCondensed ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {siteConfig.siteSubtitle}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {siteConfig.siteName}
            </h1>
            <p
              className={`text-sm text-slate-500 transition-all dark:text-slate-400 ${
                isHeaderCondensed ? 'max-h-0 overflow-hidden opacity-0 sm:max-h-6 sm:opacity-100' : 'opacity-100'
              }`}
            >
              {siteConfig.siteTagline}
            </p>
          </div>
          <div className="flex w-full items-stretch gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:w-auto sm:overflow-visible">
            <button
              aria-label={t('common.language')}
              className="inline-flex h-9 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[0.65rem] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              onClick={() => {
                const nextLocale: SupportedLocale = locale === 'de' ? 'en' : 'de'
                setLocale(nextLocale)
                setLocaleState(nextLocale)
                setIncludeLocaleInRoute(true)
              }}
              title={t('common.language')}
              type="button"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span aria-hidden="true" className="font-mono text-[0.68rem] leading-none">
                  {locale.toUpperCase()}
                </span>
              </span>
            </button>
            <button
              aria-label={theme === 'dark' ? t('theme.activateLight') : t('theme.activateDark')}
              className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.65rem] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              onClick={() => {
                setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
              }}
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  {theme === 'dark' ? (
                    <>
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2" />
                      <path d="M12 20v2" />
                      <path d="m4.93 4.93 1.41 1.41" />
                      <path d="m17.66 17.66 1.41 1.41" />
                      <path d="M2 12h2" />
                      <path d="M20 12h2" />
                      <path d="m6.34 17.66-1.41 1.41" />
                      <path d="m19.07 4.93-1.41 1.41" />
                    </>
                  ) : (
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  )}
                </svg>
              </span>
            </button>
            {navItems.map((item) => (
              <button
                className={`inline-flex h-9 w-[6.75rem] shrink-0 items-center justify-center rounded-xl border px-3 py-2 text-[0.65rem] transition sm:w-[6.5rem] ${
                  activeNavigationView === item.view
                    ? 'border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                    : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300'
                }`}
                key={item.view}
                onClick={() => handleViewChange(item.view)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <ErrorBoundary
        fallback={
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 sm:gap-10 sm:px-6 sm:py-10">
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-700/70 dark:bg-rose-900/20">
              <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-200">{t('errorBoundary.heading')}</h2>
              <p className="mt-2 text-sm text-rose-700/90 dark:text-rose-200/90">{t('errorBoundary.description')}</p>
              <button
                className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500"
                onClick={() => {
                  window.location.reload()
                }}
                type="button"
              >
                {t('errorBoundary.reload')}
              </button>
            </section>
          </main>
        }
      >
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 sm:gap-10 sm:px-6 sm:py-10"
        id="main-content"
      >
        {view === 'landing' ? (
          <LandingView
            onAttributionOpen={openAttribution}
            onSpeciesSelect={handleSpeciesSelect}
          />
        ) : view === 'species' && selectedSpecies ? (
          <SpeciesDetailView
            commonName={selectedSpecies.commonName}
            onBack={handleSpeciesBack}
            onAttributionOpen={openAttribution}
            onSpeciesSelect={handleSpeciesSelect}
            scientificName={selectedSpecies.scientificName}
          />
        ) : view === 'rarity' ? (
          <RarityView
            onAttributionOpen={openAttribution}
            onSpeciesSelect={handleSpeciesSelect}
          />
        ) : view === 'stats' ? (
          <StatisticsView
            onAttributionOpen={openAttribution}
            onSpeciesSelect={handleSpeciesSelect}
          />
        ) : (
          <DetectionsView
            onAttributionOpen={openAttribution}
            onSpeciesSelect={handleSpeciesSelect}
            view={activeNavigationView === 'archive' ? 'archive' : 'today'}
          />
        )}

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          {t('attribution.footer')}
          {' '}
          <button
            className="font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
            onClick={() => {
              setIsAttributionOpen(true)
            }}
            type="button"
          >
            {t('attribution.linkLabel')}
          </button>
          {' · '}
          <button
            className="font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
            onClick={() => {
              setIsCreditsOpen(true)
            }}
            type="button"
          >
            {t('credits.linkLabel')}
          </button>
        </p>
      </main>
      </ErrorBoundary>

      {showScrollTop ? (
        <button
          aria-label={t('scrollTop.label')}
          className="fixed bottom-6 right-6 z-40 rounded-full border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur transition hover:bg-white hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-900"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="m6 14 6-6 6 6" />
          </svg>
        </button>
      ) : null}

      {isAttributionOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsAttributionOpen(false)
            }
          }}
        >
          <div
            aria-labelledby="attribution-heading"
            aria-modal="true"
            className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            ref={attributionDialogRef}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                  {t('attribution.modalLabel')}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="attribution-heading">
                  {t('attribution.modalHeading')}
                </h2>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                ref={attributionCloseRef}
                onClick={() => {
                  setIsAttributionOpen(false)
                }}
                type="button"
              >
                {t('common.close')}
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                {t('attribution.modalDescription')}
              </p>
              {attributionRecords.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('attribution.emptyState')}
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 bg-white text-left text-sm dark:divide-slate-700 dark:bg-slate-900">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          {t('attribution.columnSpecies')}
                        </th>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          {t('attribution.columnAuthor')}
                        </th>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          {t('attribution.columnLicense')}
                        </th>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          {t('attribution.columnSource')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {attributionRecords.map((record) => (
                        <tr
                          className="align-top"
                          key={`${record.commonName}|${record.scientificName}|${record.sourceUrl || 'none'}`}
                        >
                          <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{record.commonName}</p>
                            <p className="text-slate-500 dark:text-slate-400">{record.scientificName}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300">
                            {record.author || record.credit || t('attribution.notSpecified')}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300">
                            {record.license ? (
                              record.licenseUrl ? (
                                <a
                                  className="font-medium text-slate-800 underline-offset-2 hover:underline dark:text-slate-100"
                                  href={record.licenseUrl}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {record.license}
                                </a>
                              ) : (
                                record.license
                              )
                            ) : (
                              t('attribution.notSpecified')
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300">
                            {record.sourceUrl ? (
                              <a
                                className="font-medium text-slate-800 underline-offset-2 hover:underline dark:text-slate-100"
                                href={record.sourceUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                {t('attribution.wikimediaSource')}
                              </a>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">{t('attribution.noImageLoaded')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isCreditsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsCreditsOpen(false)
            }
          }}
        >
          <div
            aria-labelledby="credits-heading"
            aria-modal="true"
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            ref={creditsDialogRef}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                  {t('credits.modalLabel')}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="credits-heading">
                  {t('credits.modalHeading')}
                </h2>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                ref={creditsCloseRef}
                onClick={() => {
                  setIsCreditsOpen(false)
                }}
                type="button"
              >
                {t('common.close')}
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-slate-700 dark:text-slate-300">
              <p>{t('credits.modalDescription')}</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{t('credits.backendTitle')}</p>
                <p className="mt-2">{t('credits.backendDescription')}</p>
                <a
                  className="mt-2 inline-block font-semibold text-slate-800 underline-offset-2 hover:underline dark:text-slate-100"
                  href="https://github.com/tphakala/birdnet-go"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('credits.backendLinkLabel')}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
