import { APIError, AuthenticationError, LockedAuth, type PayloadRequest } from 'payload'

import { AccountError } from './errors'
import { parseChangePasswordInput } from './validation'

export async function changeOwnPassword(req: PayloadRequest, body: unknown): Promise<void> {
  if (!req.user) throw new AccountError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)

  const input = parseChangePasswordInput(body)
  const username = req.user.username
  if (!username) throw new AccountError('INTERNAL_ERROR', 'No se pudo identificar al usuario.', 500)

  try {
    await req.payload.login({
      collection: 'users',
      data: {
        password: input.currentPassword,
        username,
      },
    })
  } catch (error) {
    if (error instanceof LockedAuth) {
      throw new AccountError(
        'LOCKED',
        'La cuenta está bloqueada temporalmente. Esperá e intentá de nuevo.',
        401,
      )
    }
    if (error instanceof AuthenticationError || (error instanceof APIError && error.status === 401)) {
      throw new AccountError('INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.', 401)
    }
    if (error instanceof AccountError) throw error
    throw new AccountError('INTERNAL_ERROR', 'No se pudo cambiar la contraseña.', 500)
  }

  try {
    await req.payload.update({
      collection: 'users',
      data: { password: input.newPassword },
      id: req.user.id,
      overrideAccess: false,
      req,
      user: req.user,
    })
  } catch (error) {
    if (error instanceof AccountError) throw error
    throw new AccountError('INTERNAL_ERROR', 'No se pudo cambiar la contraseña.', 500)
  }
}
