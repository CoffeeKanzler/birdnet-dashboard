import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ErrorBoundary from './ErrorBoundary'
import { renderWithQuery } from '../test/renderWithQuery'
import { reportFrontendError } from '../observability/errorReporter'

vi.mock('../observability/errorReporter', () => ({
  reportFrontendError: vi.fn(),
}))

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
    expect(reportFrontendError).toHaveBeenCalledTimes(1)
    expect(reportFrontendError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'error-boundary',
        error: expect.any(Error),
        metadata: expect.objectContaining({
          componentStack: expect.any(String),
        }),
      }),
    )
  })
})
