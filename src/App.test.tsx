import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoAttributionRecord } from './api/birdImages'
import App from './App'
import { setLocale } from './i18n'
import { renderWithQuery } from './test/renderWithQuery'

const mocks = vi.hoisted(() => {
  return {
    getPhotoAttributionRecords: vi.fn<() => PhotoAttributionRecord[]>(() => []),
    throwLandingView: false,
  }
})

vi.mock('./api/birdImages', () => ({
  getPhotoAttributionRecords: mocks.getPhotoAttributionRecords,
}))

vi.mock('./features/landing/LandingView', () => ({
  default: ({
    onAttributionOpen,
    onSpeciesSelect,
  }: {
    onAttributionOpen: () => void
    onSpeciesSelect: (species: { commonName: string; scientificName: string }) => void
  }) => (
    (() => {
      if (mocks.throwLandingView) {
        throw new Error('landing exploded')
      }

      return (
        <div>
          Landing View
          <button
            onClick={() => {
              onSpeciesSelect({ commonName: 'Barn Owl', scientificName: 'Tyto alba' })
            }}
            type="button"
          >
            Select Barn Owl
          </button>
          <button onClick={onAttributionOpen} type="button">
            Open Attribution From Landing
          </button>
        </div>
      )
    })()
  ),
}))

vi.mock('./features/detections/DetectionsView', () => ({
  default: ({
    onSpeciesSelect,
    view,
  }: {
    onSpeciesSelect: (species: { commonName: string; scientificName: string }) => void
    view: 'today' | 'archive'
  }) => (
    <div>
      Detections View: {view}
      <button
        onClick={() => {
          onSpeciesSelect({ commonName: 'Robin', scientificName: 'Erithacus rubecula' })
        }}
        type="button"
      >
        Select Robin
      </button>
    </div>
  ),
}))

vi.mock('./features/rarity/RarityView', () => ({
  default: ({
    onAttributionOpen,
  }: {
    onAttributionOpen: () => void
  }) => (
    <div>
      Rarity View
      <button onClick={onAttributionOpen} type="button">
        Open Attribution From Rarity
      </button>
    </div>
  ),
}))

vi.mock('./features/statistics/StatisticsView', () => ({
  default: ({
    onSpeciesSelect,
  }: {
    onSpeciesSelect: (species: { commonName: string; scientificName: string }) => void
  }) => (
    <div>
      Statistics View
      <button
        onClick={() => {
          onSpeciesSelect({ commonName: 'Eisvogel', scientificName: 'Alcedo atthis' })
        }}
        type="button"
      >
        Select Eisvogel
      </button>
    </div>
  ),
}))

vi.mock('./features/species/SpeciesDetailView', () => ({
  default: ({
    commonName,
    scientificName,
    onBack,
    onSpeciesSelect,
  }: {
    commonName: string
    scientificName: string
    onBack: () => void
    onSpeciesSelect: (species: { commonName: string; scientificName: string }) => void
  }) => (
    <div>
      Species Detail: {commonName} ({scientificName})
      <button onClick={onBack} type="button">
        Back To Source
      </button>
      <button
        onClick={() => {
          onSpeciesSelect({
            commonName: 'Song Thrush',
            scientificName: 'Turdus philomelos',
          })
        }}
        type="button"
      >
        Select Related Species
      </button>
    </div>
  ),
}))

describe('App navigation and URL state', () => {
  beforeEach(() => {
    mocks.getPhotoAttributionRecords.mockReset()
    mocks.getPhotoAttributionRecords.mockReturnValue([])
    mocks.throwLandingView = false
    setLocale('de')
    document.documentElement.lang = 'de'
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('navigates between main views and keeps URL view param in sync', () => {
    renderWithQuery(<App />)

    expect(screen.getByText('Landing View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=landing')

    fireEvent.click(screen.getByRole('button', { name: 'Archiv' }))
    expect(screen.getByText('Detections View: archive')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=archive')

    fireEvent.click(screen.getByRole('button', { name: 'Highlights' }))
    expect(screen.getByText('Rarity View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=rarity')

    fireEvent.click(screen.getByRole('button', { name: 'Statistik' }))
    expect(screen.getByText('Statistics View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=stats')

    fireEvent.click(screen.getByRole('button', { name: 'Heute' }))
    expect(screen.getByText('Detections View: today')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=today')

    fireEvent.click(screen.getByRole('button', { name: 'Live' }))
    expect(screen.getByText('Landing View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=landing')
  })

  it('navigates to stats view via deep link and supports back navigation from species', () => {
    window.history.replaceState(null, '', '/?view=stats')

    renderWithQuery(<App />)

    expect(screen.getByText('Statistics View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=stats')

    fireEvent.click(screen.getByRole('button', { name: 'Select Eisvogel' }))
    expect(window.location.search).toContain('view=species')
    expect(window.location.search).toContain('from=stats')
    expect(window.location.search).toContain('scientific=Alcedo+atthis')
    expect(window.location.search).not.toContain('common=')

    fireEvent.click(screen.getByRole('button', { name: 'Back To Source' }))
    expect(screen.getByText('Statistics View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=stats')
  })

  it('switches language at runtime and persists locale in URL/localStorage', async () => {
    renderWithQuery(<App />)

    expect(screen.getByRole('button', { name: 'Heute' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sprache' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
    })

    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('birdnet-showoff-locale')).toBe('en')
    expect(window.location.search).toContain('lang=en')
  })

  it('parses scientific-only species route and returns to source view on back', () => {
    window.history.replaceState(
      null,
      '',
      '/?view=species&from=archive&scientific=Tyto%20alba',
    )

    renderWithQuery(<App />)

    expect(screen.getByText('Species Detail: Tyto alba (Tyto alba)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back To Source' }))

    expect(screen.getByText('Detections View: archive')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=archive')
  })

  it('handles species selection from non-main view and popstate updates', async () => {
    renderWithQuery(<App />)

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 100,
      writable: true,
    })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    window.scrollY = 30
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Select Barn Owl' }))
    expect(screen.getByText('Species Detail: Barn Owl (Tyto alba)')).toBeInTheDocument()
    expect(window.location.search).toContain('view=species')
    expect(window.location.search).not.toContain('common=')

    fireEvent.click(screen.getByRole('button', { name: 'Select Related Species' }))
    expect(screen.getByText('Species Detail: Song Thrush (Turdus philomelos)')).toBeInTheDocument()

    act(() => {
      window.history.pushState(null, '', '/?view=archive')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await waitFor(() => {
      expect(screen.getByText('Detections View: archive')).toBeInTheDocument()
    })
    expect(window.location.search).toBe('?view=archive')
  })

  it('opens attribution modal from feature action and footer, and updates records on event', async () => {
    const records: PhotoAttributionRecord[] = []
    mocks.getPhotoAttributionRecords.mockImplementation(() => records)
    window.localStorage.setItem('birdnet-showoff-theme', 'dark')

    renderWithQuery(<App />)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Helles Design aktivieren' }))
    expect(window.localStorage.getItem('birdnet-showoff-theme')).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Open Attribution From Landing' }))
    expect(screen.getByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: /Schlie/ }))
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Bildnachweise' }))
    expect(screen.getByText(/Noch keine Bildnachweise geladen/)).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    records.push({
      commonName: 'Amsel',
      scientificName: 'Turdus merula',
      hasImage: true,
      sourceUrl: 'https://example.test/source',
      author: 'Tester',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://example.test/license',
    })
    act(() => {
      window.dispatchEvent(new Event('birdnet-attribution-updated'))
    })

    await waitFor(() => {
      expect(screen.getByText('Amsel')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Schlie/ }))
    expect(screen.queryByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeNull()
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('')
    })
  })

  it('supports modal keyboard controls and focus trap', async () => {
    mocks.getPhotoAttributionRecords.mockReturnValue([
      {
        commonName: 'Amsel',
        scientificName: 'Turdus merula',
        hasImage: true,
        sourceUrl: 'https://example.test/source',
        author: 'Tester',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://example.test/license',
      },
    ])

    renderWithQuery(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Bildnachweise' }))

    const closeButton = screen.getByRole('button', { name: /Schlie/ })
    await waitFor(() => {
      expect(closeButton).toHaveFocus()
    })

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('link', { name: 'Wikimedia-Quelle' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeNull()
    })
  })

  it('closes attribution modal when clicking backdrop', async () => {
    renderWithQuery(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Bildnachweise' }))
    expect(screen.getByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Wikimedia/Wikipedia Lizenzen' })).toBeNull()
    })
  })

  it('shows error boundary fallback when a view throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.throwLandingView = true

    renderWithQuery(<App />)

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seite neu laden' })).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalled()
  })
})
