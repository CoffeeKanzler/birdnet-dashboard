import { useEffect, useState } from 'react'

import { getPhotoAttributionRecords } from './api/birdImages'
import DetectionsView from './features/detections/DetectionsView'
import LandingView from './features/landing/LandingView'
import RarityView from './features/rarity/RarityView'
import SpeciesDetailView from './features/species/SpeciesDetailView'

type MainView = 'landing' | 'today' | 'archive' | 'rarity'
type AppView = MainView | 'species'

type SelectedSpecies = {
  commonName: string
  scientificName: string
}

type AppRouteState = {
  view: AppView
  lastMainView: 'today' | 'archive' | 'rarity'
  selectedSpecies: SelectedSpecies | null
}

type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'birdnet-showoff-theme'

const getInitialTheme = (): ThemeMode => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
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
    const lastMainView =
      from === 'today' || from === 'archive' || from === 'rarity' ? from : 'today'

    if (commonName && scientificName) {
      return {
        view: 'species',
        lastMainView,
        selectedSpecies: { commonName, scientificName },
      }
    }
  }

  if (routeView === 'today' || routeView === 'archive' || routeView === 'rarity') {
    return {
      view: routeView,
      lastMainView: routeView,
      selectedSpecies: null,
    }
  }

  return {
    view: 'landing',
    lastMainView: 'today',
    selectedSpecies: null,
  }
}

const createRoute = (state: AppRouteState): string => {
  const params = new URLSearchParams()

  if (state.view === 'species' && state.selectedSpecies) {
    params.set('view', 'species')
    params.set('from', state.lastMainView)
    params.set('common', state.selectedSpecies.commonName)
    params.set('scientific', state.selectedSpecies.scientificName)
  } else {
    params.set('view', state.view)
  }

  const query = params.toString()
  return query ? `?${query}` : window.location.pathname
}

const App = () => {
  const initialState = parseRouteState()
  const [view, setView] = useState<AppView>(initialState.view)
  const [lastMainView, setLastMainView] = useState<'today' | 'archive' | 'rarity'>(
    initialState.lastMainView,
  )
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies | null>(
    initialState.selectedSpecies,
  )
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [isHeaderCondensed, setIsHeaderCondensed] = useState(false)
  const [isAttributionOpen, setIsAttributionOpen] = useState(false)
  const [, setAttributionVersion] = useState(0)

  const updateHistory = (state: AppRouteState, mode: 'push' | 'replace') => {
    const nextUrl = createRoute(state)
    if (mode === 'push') {
      window.history.pushState(null, '', nextUrl)
      return
    }

    window.history.replaceState(null, '', nextUrl)
  }

  useEffect(() => {
    const initialRoute = parseRouteState()
    const nextUrl = createRoute(initialRoute)
    window.history.replaceState(null, '', nextUrl)
  }, [])

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
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
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
      nextView === 'today' || nextView === 'archive' || nextView === 'rarity'
        ? nextView
        : lastMainView

    if (nextView === 'today' || nextView === 'archive' || nextView === 'rarity') {
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
      view === 'today' || view === 'archive' || view === 'rarity'
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

  const activeNavigationView = view
  const openAttribution = () => {
    setIsAttributionOpen(true)
  }

  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 sm:pt-4">
        <div
          className={`mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 shadow-sm backdrop-blur transition-all sm:flex-row sm:items-center sm:justify-between ${
            isHeaderCondensed ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
          }`}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              BirdNET-Go
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              BirdNET Dashboard
            </h1>
            <p
              className={`text-sm text-slate-500 transition-all ${
                isHeaderCondensed ? 'max-h-0 overflow-hidden opacity-0 sm:max-h-6 sm:opacity-100' : 'opacity-100'
              }`}
            >
              Live-Erkennungen aus der garden.
            </p>
          </div>
          <div className="flex w-full items-stretch gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:w-auto sm:overflow-visible">
            <button
              aria-label={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
              className="inline-flex h-9 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.65rem] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => {
                setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
              }}
              title={theme === 'dark' ? 'Hell' : 'Dunkel'}
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
                <span className="hidden sm:inline">{theme === 'dark' ? 'Hell' : 'Dunkel'}</span>
              </span>
            </button>
            <button
              className={`inline-flex h-9 shrink-0 items-center rounded-xl border px-4 py-2 text-[0.65rem] transition ${
                activeNavigationView === 'landing'
                  ? 'border-slate-200 bg-white text-slate-900 shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => handleViewChange('landing')}
              type="button"
            >
              Live
            </button>
            <button
              className={`inline-flex h-9 shrink-0 items-center rounded-xl border px-4 py-2 text-[0.65rem] transition ${
                activeNavigationView === 'today'
                  ? 'border-slate-200 bg-white text-slate-900 shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => handleViewChange('today')}
              type="button"
            >
              Heute
            </button>
            <button
              className={`inline-flex h-9 shrink-0 items-center rounded-xl border px-4 py-2 text-[0.65rem] transition ${
                activeNavigationView === 'archive'
                  ? 'border-slate-200 bg-white text-slate-900 shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => handleViewChange('archive')}
              type="button"
            >
              Archiv
            </button>
            <button
              className={`inline-flex h-9 shrink-0 items-center rounded-xl border px-4 py-2 text-[0.65rem] transition ${
                activeNavigationView === 'rarity'
                  ? 'border-slate-200 bg-white text-slate-900 shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => handleViewChange('rarity')}
              type="button"
            >
              Highlights
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 sm:gap-10 sm:px-6 sm:py-10">
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
        ) : (
          <DetectionsView
            onAttributionOpen={openAttribution}
            onSpeciesSelect={handleSpeciesSelect}
            view={activeNavigationView === 'archive' ? 'archive' : 'today'}
          />
        )}

        <p className="text-center text-xs text-slate-500">
          Bilder stammen aus Wikipedia/Wikimedia. Es gelten die jeweils dort angegebenen Lizenzbedingungen.
          {' '}
          <button
            className="font-semibold text-slate-700 underline-offset-2 hover:underline"
            onClick={() => {
              setIsAttributionOpen(true)
            }}
            type="button"
          >
            Bildnachweise
          </button>
        </p>
      </main>

      {isAttributionOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Bildnachweise
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Wikimedia/Wikipedia Lizenzen
                </h2>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-200"
                onClick={() => {
                  setIsAttributionOpen(false)
                }}
                type="button"
              >
                Schließen
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <p className="mb-4 text-xs text-slate-500">
                Diese Liste zeigt aktuell geladene Bilder inklusive Urheber- und Lizenzhinweis.
              </p>
              {attributionRecords.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Noch keine Bildnachweise geladen. Sobald Artenbilder sichtbar sind,
                  erscheinen hier automatisch Urheber- und Lizenzangaben.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 bg-white text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          Art
                        </th>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          Urheber
                        </th>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          Lizenz
                        </th>
                        <th className="px-3 py-3 font-semibold" scope="col">
                          Quelle
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attributionRecords.map((record) => (
                        <tr
                          className="align-top"
                          key={`${record.commonName}|${record.scientificName}|${record.sourceUrl || 'none'}`}
                        >
                          <td className="px-3 py-3 text-xs text-slate-700">
                            <p className="font-semibold text-slate-800">{record.commonName}</p>
                            <p className="text-slate-500">{record.scientificName}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-700">
                            {record.author || record.credit || 'nicht angegeben'}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-700">
                            {record.license ? (
                              record.licenseUrl ? (
                                <a
                                  className="font-medium text-slate-800 underline-offset-2 hover:underline"
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
                              'nicht angegeben'
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-700">
                            {record.sourceUrl ? (
                              <a
                                className="font-medium text-slate-800 underline-offset-2 hover:underline"
                                href={record.sourceUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Wikimedia-Quelle
                              </a>
                            ) : (
                              <span className="text-slate-500">Kein Bild geladen</span>
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
    </div>
  )
}

export default App
