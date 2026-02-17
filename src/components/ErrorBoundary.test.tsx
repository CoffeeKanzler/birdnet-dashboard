import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ErrorBoundary from './ErrorBoundary'
import { renderWithQuery } from '../test/renderWithQuery'

const Boom = () => {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    renderWithQuery(
      <ErrorBoundary fallback={<div>Fallback</div>}>
        <div>Safe child</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText('Safe child')).toBeInTheDocument()
  })

  it('renders fallback when child throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithQuery(
      <ErrorBoundary fallback={<button type="button">Try again</button>}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  })
})
