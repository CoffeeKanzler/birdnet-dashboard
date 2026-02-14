const padDateValue = (value: number): string => value.toString().padStart(2, '0')

export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear()
  const month = padDateValue(date.getMonth() + 1)
  const day = padDateValue(date.getDate())
  return `${year}-${month}-${day}`
}

export const parseDateInput = (value: string): Date | null => {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.valueOf())) {
    return null
  }

  return parsed
}

export const formatDisplayDate = (value: string): string => {
  const parsed = parseDateInput(value)
  if (!parsed) {
    return 'Unbekannt'
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
  }).format(parsed)
}
