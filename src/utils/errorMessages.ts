import { ApiClientError } from '../api/apiClient'

const HTTP_STATUS_PATTERN = /(\d{3})/

const toServiceLabel = (serviceName?: string): string => {
  return serviceName?.trim() || 'Backend'
}

const messageForStatus = (status: number, serviceLabel: string): string => {
  if (status === 401 || status === 403) {
    return `Zugriff auf ${serviceLabel} wurde verweigert.`
  }

  if (status === 404) {
    return `${serviceLabel} konnte die angeforderten Daten nicht finden.`
  }

  if (status === 429) {
    return `Zu viele Anfragen an ${serviceLabel}. Bitte in kurzem Abstand erneut versuchen.`
  }

  if (status >= 500) {
    return `${serviceLabel} ist momentan nicht verfuegbar. Bitte spaeter erneut versuchen.`
  }

  return `Anfrage an ${serviceLabel} ist fehlgeschlagen.`
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
      return `${serviceLabel} hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.`
    }

    if (error.code === 'network') {
      return `Verbindung zu ${serviceLabel} fehlgeschlagen. Bitte Netzwerk pruefen und erneut versuchen.`
    }

    if (error.code === 'parse') {
      return `Antwort von ${serviceLabel} konnte nicht verarbeitet werden.`
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
