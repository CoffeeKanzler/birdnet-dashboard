const FAMILY_SEPARATOR_PATTERN = /\s*(?:,|\/|;|\||&|\+)\s*|\s+(?:and|und)\s+/gi

const normalizeToken = (value) => {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export const tokenizeFamilyLabel = (value) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return []
  }
  return Array.from(
    new Set(
      normalized
        .split(FAMILY_SEPARATOR_PATTERN)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  )
}

export const hasFamilyIntersection = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
    return false
  }
  const rightSet = new Set(right)
  return left.some((token) => rightSet.has(token))
}
