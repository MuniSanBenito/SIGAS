const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validatePositiveInteger(value: unknown): true | string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? true
    : 'Debe ser un número entero positivo.'
}

export function validateNonNegativeInteger(value: unknown): true | string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? true
    : 'Debe ser un número entero mayor o igual a cero.'
}

export function validateDateOnly(value: unknown): true | string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return 'Debe usar el formato YYYY-MM-DD.'

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? true
    : 'Debe ser una fecha válida.'
}

export function validateRequiredText(value: unknown): true | string {
  return typeof value === 'string' && value.trim() ? true : 'Este campo es obligatorio.'
}
