import { AuthenticationError, LockedAuth } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { changeOwnPassword } from './password-service'

const input = {
  confirmPassword: 'nueva-clave',
  currentPassword: 'clave-actual',
  newPassword: 'nueva-clave',
}

function request(login = vi.fn(async () => ({})), update = vi.fn(async () => ({}))) {
  return {
    login,
    req: {
      payload: { login, update },
      user: { collection: 'users', id: 'user-1', username: '30111222' },
    },
    update,
  }
}

describe('changeOwnPassword', () => {
  it('rejects a missing session before checking the password', async () => {
    const login = vi.fn()
    await expect(changeOwnPassword({ payload: { login }, user: null } as never, input)).rejects.toThrow(
      'La sesión es obligatoria.',
    )
    expect(login).not.toHaveBeenCalled()
  })

  it('verifies the current password and stores only the new one', async () => {
    const { login, req, update } = request()

    await changeOwnPassword(req as never, input)

    expect(login).toHaveBeenCalledWith({
      collection: 'users',
      data: { password: 'clave-actual', username: '30111222' },
    })
    expect(update).toHaveBeenCalledWith({
      collection: 'users',
      data: { password: 'nueva-clave' },
      id: 'user-1',
      overrideAccess: false,
      req,
      user: req.user,
    })
  })

  it('does not change the password when the current one is wrong', async () => {
    const { login, req, update } = request(vi.fn(async () => {
      throw new AuthenticationError()
    }))

    await expect(changeOwnPassword(req as never, input)).rejects.toThrow('La contraseña actual no es correcta.')
    expect(update).not.toHaveBeenCalled()
    expect(login).toHaveBeenCalled()
  })

  it('reports a locked account without changing the password', async () => {
    const { req, update } = request(vi.fn(async () => {
      throw new LockedAuth()
    }))

    await expect(changeOwnPassword(req as never, input)).rejects.toThrow(
      'La cuenta está bloqueada temporalmente. Esperá e intentá de nuevo.',
    )
    expect(update).not.toHaveBeenCalled()
  })
})
