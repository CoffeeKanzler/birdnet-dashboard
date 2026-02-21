export const FRONTEND_ERROR_EVENT = 'birdnet-frontend-error'

type ErrorMetadataValue = string | number | boolean | null

type ReportFrontendErrorOptions = {
  source: string
  error: unknown
  metadata?: Record<string, ErrorMetadataValue>
}

type FrontendErrorRecord = {
  id: string
  source: string
  name: string
  message: string
  timestamp: string
  release: string
  metadata?: Record<string, ErrorMetadataValue>
}

const MAX_ERROR_RECORDS = 200
const frontendErrorRecords: FrontendErrorRecord[] = []

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

const toRelease = (): string => {
  const value = import.meta.env.VITE_APP_VERSION ?? 'dev'
  const normalized = value.trim()
  return normalized || 'dev'
}

const toErrorParts = (error: unknown): { name: string; message: string } => {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
    }
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}

export const reportFrontendError = ({
  source,
  error,
  metadata,
}: ReportFrontendErrorOptions): FrontendErrorRecord => {
  const parts = toErrorParts(error)
  const record: FrontendErrorRecord = {
    id: createId(),
    source,
    name: parts.name,
    message: parts.message,
    timestamp: new Date().toISOString(),
    release: toRelease(),
    metadata,
  }

  frontendErrorRecords.push(record)
  while (frontendErrorRecords.length > MAX_ERROR_RECORDS) {
    frontendErrorRecords.shift()
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRONTEND_ERROR_EVENT, { detail: record }))
  }

  if (import.meta.env.DEV) {
    console.error(`[frontend-error] ${source}: ${record.message}`, {
      name: record.name,
      release: record.release,
      metadata,
    })
  }

  return record
}

export const getFrontendErrorRecords = (): FrontendErrorRecord[] => {
  return [...frontendErrorRecords]
}

export const clearFrontendErrorRecords = (): void => {
  frontendErrorRecords.length = 0
}
