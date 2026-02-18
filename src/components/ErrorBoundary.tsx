import { type ErrorInfo, type ReactNode, Component } from 'react'
import { reportFrontendError } from '../observability/errorReporter'

type ErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportFrontendError({
      source: 'error-boundary',
      error,
      metadata: {
        componentStack: errorInfo.componentStack || null,
      },
    })
    console.error('Application render failed', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

export default ErrorBoundary
