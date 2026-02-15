import { QueryCache, QueryClient } from '@tanstack/react-query'

import { reportFrontendError } from '../observability/errorReporter'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      retryDelay: (attempt) => 300 * 2 ** Math.max(0, attempt - 1),
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const source = (query.meta?.source as string) ?? 'unknown'
      const metadata = query.meta as Record<string, string | number | boolean | null> | undefined
      reportFrontendError({ source, error, metadata })
    },
  }),
})
