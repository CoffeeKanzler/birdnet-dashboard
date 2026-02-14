import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

vi.mock('./api/birdImages', () => ({
  getPhotoAttributionRecords: () => [],
}))

vi.mock('./features/landing/LandingView', () => ({
  default: () => <div>Landing View</div>,
}))

vi.mock('./features/detections/DetectionsView', () => ({
  default: ({ view }: { view: 'today' | 'archive' }) => <div>Detections View: {view}</div>,
}))

vi.mock('./features/rarity/RarityView', () => ({
  default: () => <div>Rarity View</div>,
}))

vi.mock('./features/species/SpeciesDetailView', () => ({
  default: ({
    commonName,
    scientificName,
    onBack,
  }: {
    commonName: string
    scientificName: string
    onBack: () => void
  }) => (
    <div>
      Species Detail: {commonName} ({scientificName})
      <button onClick={onBack} type="button">
        Back To Source
      </button>
    </div>
  ),
}))

describe('App navigation and URL state', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('navigates between main views and keeps URL view param in sync', () => {
    render(<App />)

    expect(screen.getByText('Landing View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=landing')

    fireEvent.click(screen.getByRole('button', { name: 'Archiv' }))
    expect(screen.getByText('Detections View: archive')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=archive')

    fireEvent.click(screen.getByRole('button', { name: 'Highlights' }))
    expect(screen.getByText('Rarity View')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=rarity')

    fireEvent.click(screen.getByRole('button', { name: 'Heute' }))
    expect(screen.getByText('Detections View: today')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=today')
  })

  it('parses species route and returns to source view on back', () => {
    window.history.replaceState(
      null,
      '',
      '/?view=species&from=archive&common=Barn%20Owl&scientific=Tyto%20alba',
    )

    render(<App />)

    expect(screen.getByText('Species Detail: Barn Owl (Tyto alba)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back To Source' }))

    expect(screen.getByText('Detections View: archive')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=archive')
  })
})
