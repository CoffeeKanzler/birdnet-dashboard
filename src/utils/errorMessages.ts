import { ApiClientError } from '../api/apiClient'
import { t } from '../i18n'

const HTTP_STATUS_PATTERN = /(\d{3})/

const toServiceLabel = (serviceName?: string): string => {
  return serviceName?.trim() || 'Backend'
}

const messageForStatus = (status: number, serviceLabel: string): string => {
  if (status === 401 || status === 403) {
    return t('error.accessDenied', { service: serviceLabel })
  }

  if (status === 404) {
    return t('error.notFound', { service: serviceLabel })
  }

  if (status === 429) {
    return t('error.tooManyRequests', { service: serviceLabel })
  }

  if (status >= 500) {
    return t('error.serverError', { service: serviceLabel })
  }

  return t('error.requestFailed', { service: serviceLabel })
}

const parseStatus = (error: Error): number | null => {
  const match = error.message.match(HTTP_STATUS_PATTERN)
  if (!match?.[1]) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isNaN(parsed) ? null : parsed
}

export const toUserErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  serviceName?: string,
): string => {
  const serviceLabel = toServiceLabel(serviceName)

  if (error instanceof ApiClientError) {
    if (error.code === 'timeout') {
      return t('error.timeout', { service: serviceLabel })
    }

    if (error.code === 'network') {
      return t('error.network', { service: serviceLabel })
    }

    if (error.code === 'parse') {
      return t('error.parse', { service: serviceLabel })
    }

    if (error.code === 'http' && typeof error.status === 'number') {
      return messageForStatus(error.status, serviceLabel)
    }

    if (error.code === 'aborted') {
      return fallbackMessage
    }
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return fallbackMessage
    }

    const status = parseStatus(error)
    if (status !== null) {
      return messageForStatus(status, serviceLabel)
    }
  }

  return fallbackMessage
}
