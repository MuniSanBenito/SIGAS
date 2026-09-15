import { describe, expect, it } from 'vitest'

import { contribuyenteEndpoints } from './contribuyentes'

type TestRequest = {
  user?: unknown
  url: string
}

function handler(method: string, path: string) {
  const endpoint = contribuyenteEndpoints.find((item) => item.method === method && item.path === path)
  if (!endpoint?.handler) throw new Error(`Missing endpoint ${method} ${path}`)
  return endpoint.handler as unknown as (request: TestRequest) => Promise<Response>
}

describe('contribuyente endpoints', () => {
  it('rejects unauthenticated requests before contacting the external API', async () => {
    const response = await handler('get', '/contribuyentes')({ url: 'http://localhost/api/contribuyentes' })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'La sesión es obligatoria.' },
    })
  })

  it('rejects authenticated users without an allowed role', async () => {
    const response = await handler('get', '/contribuyentes')({
      url: 'http://localhost/api/contribuyentes',
      user: { roles: ['stock'] },
    })

    expect(response.status).toBe(403)
  })

  it('validates create input before calling the external API', async () => {
    const response = await (handler('post', '/contribuyentes') as unknown as (request: TestRequest & { json: () => Promise<unknown> }) => Promise<Response>)({
      url: 'http://localhost/api/contribuyentes',
      user: { roles: ['admin'] },
      json: async () => ({ dni: '30123456' }),
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Nombre y apellido son obligatorios.' },
    })
  })
})
