import type { Endpoint, PayloadRequest } from 'payload'

import { AccountError, accountErrorResponse } from '@/account/errors'
import { changeOwnPassword } from '@/account/password-service'

async function requestBody(req: PayloadRequest): Promise<unknown> {
  if (typeof req.json !== 'function') return req.data
  try {
    return await req.json()
  } catch {
    throw new AccountError('VALIDATION_ERROR', 'Los datos de la contraseña no son válidos.', 422)
  }
}

async function changePasswordEndpoint(req: PayloadRequest): Promise<Response> {
  try {
    await changeOwnPassword(req, await requestBody(req))
    return Response.json({ ok: true })
  } catch (error) {
    return accountErrorResponse(error)
  }
}

export const accountEndpoints: Endpoint[] = [
  {
    handler: changePasswordEndpoint,
    method: 'post',
    path: '/cuenta/contrasena',
  },
]
