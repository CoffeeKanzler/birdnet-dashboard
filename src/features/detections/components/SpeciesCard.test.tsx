import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpeciesCard from './SpeciesCard'

const mocks = vi.hoisted(() => ({
  useSpeciesPhoto: vi.fn(),
}))

vi.mock('../useSpeciesPhoto', () => ({
  useSpeciesPhoto: mocks.useSpeciesPhoto,
}))

vi.mock('../../../i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  getLocalizedCommonName: (commonName: string) => commonName,
}))

describe('SpeciesCard', () => {
  beforeEach(() => {
    mocks.useSpeciesPhoto.mockReturnValue({ photo: null, isLoading: false })
  })

  it('renders as a non-interactive article when no onSelect is given', () => {
    const { container } = render(
      <SpeciesCard commonName="Amsel" scientificName="Turdus merula" />,
    )

    const card = container.querySelector('article')
    expect(card).not.toBeNull()
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabindex')
  })

  it('renders a loading skeleton while the photo is loading', () => {
    mocks.useSpeciesPhoto.mockReturnValue({ photo: null, isLoading: true })

    const { container } = render(
      <SpeciesCard commonName="Amsel" scientificName="Turdus merula" />,
    )

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders a fallback placeholder when there is no photo and loading has finished', () => {
    render(<SpeciesCard commonName="Amsel" scientificName="Turdus merula" />)

    expect(screen.getByText('common.noImage')).toBeInTheDocument()
  })

  it('renders the photo image when available', () => {
    mocks.useSpeciesPhoto.mockReturnValue({
      photo: {
        url: 'https://example.com/amsel.jpg',
        width: 400,
        height: 300,
        sourceUrl: 'https://example.com/amsel',
      },
      isLoading: false,
    })

    render(<SpeciesCard commonName="Amsel" scientificName="Turdus merula" />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/amsel.jpg')
    expect(img).toHaveAttribute('width', '400')
    expect(img).toHaveAttribute('height', '300')
  })

  it('shows an attribution button only when the photo has a sourceUrl, and calls onAttributionOpen without triggering select', () => {
    const onSelect = vi.fn()
    const onAttributionOpen = vi.fn()
    mocks.useSpeciesPhoto.mockReturnValue({
      photo: {
        url: 'https://example.com/amsel.jpg',
        width: 400,
        height: 300,
        sourceUrl: 'https://example.com/amsel',
        attribution: { author: 'Jane Doe', license: 'CC-BY' },
      },
      isLoading: false,
    })

    render(
      <SpeciesCard
        commonName="Amsel"
        scientificName="Turdus merula"
        onAttributionOpen={onAttributionOpen}
        onSelect={onSelect}
      />,
    )

    const attributionButton = screen.getByTitle(/attribution.author/)
    fireEvent.click(attributionButton)

    expect(onAttributionOpen).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('is interactive when onSelect is provided: renders as a div with button role and responds to click and keyboard', () => {
    const onSelect = vi.fn()

    const { container } = render(
      <SpeciesCard commonName="Amsel" scientificName="Turdus merula" onSelect={onSelect} />,
    )

    const card = screen.getByRole('button')
    expect(container.querySelector('article')).toBeNull()
    expect(card).toHaveAttribute('tabindex', '0')

    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledWith({ commonName: 'Amsel', scientificName: 'Turdus merula' })

    onSelect.mockClear()
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)

    onSelect.mockClear()
    fireEvent.keyDown(card, { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(1)

    onSelect.mockClear()
    fireEvent.keyDown(card, { key: 'a' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows a detection count badge only when count is a number', () => {
    const { rerender } = render(
      <SpeciesCard commonName="Amsel" scientificName="Turdus merula" count={7} />,
    )

    expect(screen.getByText(/common.detections/)).toBeInTheDocument()

    rerender(<SpeciesCard commonName="Amsel" scientificName="Turdus merula" />)

    expect(screen.queryByText(/common.detections/)).not.toBeInTheDocument()
  })

  it('applies highlight styling when highlight is true', () => {
    const { container } = render(
      <SpeciesCard commonName="Amsel" scientificName="Turdus merula" highlight />,
    )

    expect(container.firstElementChild?.className).toContain('border-emerald-200')
  })
})
