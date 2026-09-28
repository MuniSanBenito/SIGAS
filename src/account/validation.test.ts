import { describe, expect, it } from 'vitest'

import { parseChangePasswordInput } from './validation'

const valid = {
  confirmPassword: 'nueva-clave',
  currentPassword: 'test',
  newPassword: 'nueva-clave',
}

describe('change password validation', () => {
  it('accepts the current password and a distinct new password', () => {
    expect(parseChangePasswordInput(valid)).toEqual({
      currentPassword: 'test',
      newPassword: 'nueva-clave',
    })
  })

  it('requires the current password', () => {
    expect(() => parseChangePasswordInput({ ...valid, currentPassword: '' })).toThrow(
      'La contraseña actual es obligatoria.',
    )
  })

  it('requires a new password of at least 8 characters', () => {
    expect(() => parseChangePasswordInput({ ...valid, confirmPassword: 'corta', newPassword: 'corta' })).toThrow(
      'La nueva contraseña debe tener al menos 8 caracteres.',
    )
  })

  it('rejects a confirmation that does not match', () => {
    expect(() => parseChangePasswordInput({ ...valid, confirmPassword: 'otra-clave' })).toThrow(
      'La confirmación no coincide con la nueva contraseña.',
    )
  })

  it('rejects a new password equal to the current one', () => {
    expect(() =>
      parseChangePasswordInput({
        confirmPassword: 'misma-clave',
        currentPassword: 'misma-clave',
        newPassword: 'misma-clave',
      }),
    ).toThrow('La nueva contraseña tiene que ser distinta de la actual.')
  })
})
