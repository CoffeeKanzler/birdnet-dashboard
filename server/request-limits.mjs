export const parseBoundedPositiveInt = (value, fallback, maximum) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return fallback
  }
  return Math.min(parsed, maximum)
}

export const normalizeDetectionsQuery = (searchParams) => {
  const params = new URLSearchParams(searchParams)
  params.set(
    'numResults',
    String(parseBoundedPositiveInt(params.get('numResults'), 500, 500)),
  )
  params.set('offset', String(parseBoundedPositiveInt(params.get('offset'), 0, 100_000)))
  return params
}

export const sliceDetectionsPage = (detections, searchParams) => {
  const params = normalizeDetectionsQuery(searchParams)
  const limit = Number(params.get('numResults'))
  const offset = Number(params.get('offset'))
  return detections.slice(offset, offset + limit)
}
