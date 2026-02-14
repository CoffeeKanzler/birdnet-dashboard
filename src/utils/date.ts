const pad = (value: number): string => value.toString().padStart(2, '0')

export const formatDateYMD = (date: Date): string => {
  if (!date || Number.isNaN(date.valueOf())) {
    return ''
  }

  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())

  return `${year}-${month}-${day}`
}
