import { AccountError } from './errors'

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredPassword(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AccountError('VALIDATION_ERROR', message, 422)
  }
  return value
}

export function parseChangePasswordInput(value: unknown): ChangePasswordInput {
  if (!isRecord(value)) {
    throw new AccountError('VALIDATION_ERROR', 'Los datos de la contraseña no son válidos.', 422)
  }

  const currentPassword = requiredPassword(value.currentPassword, 'La contraseña actual es obligatoria.')
  const newPassword = requiredPassword(value.newPassword, 'La nueva contraseña es obligatoria.')
  const confirmPassword = requiredPassword(value.confirmPassword, 'La confirmación de la contraseña es obligatoria.')

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AccountError('VALIDATION_ERROR', 'La nueva contraseña debe tener al menos 8 caracteres.', 422)
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new AccountError('VALIDATION_ERROR', 'La nueva contraseña es demasiado larga.', 422)
  }
  if (newPassword !== confirmPassword) {
    throw new AccountError('VALIDATION_ERROR', 'La confirmación no coincide con la nueva contraseña.', 422)
  }
  if (newPassword === currentPassword) {
    throw new AccountError('VALIDATION_ERROR', 'La nueva contraseña tiene que ser distinta de la actual.', 422)
  }

  return { currentPassword, newPassword }
}
