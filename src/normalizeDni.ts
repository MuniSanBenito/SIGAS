const DNI_SEPARATORS = /[.\s-]/g

export function normalizeDni(value: string): string {
  const normalized = value.replace(DNI_SEPARATORS, '')

  if (!/^\d+$/.test(normalized)) {
    throw new Error('DNI must contain only digits')
  }

  return normalized
}
