import { describe, expect, it } from 'vitest'

import { deliveryEndpoints } from './entregas'

type TestRequest = {
  user?: unknown
  url: string
}

function handler(method: string, path: string) {
  const endpoint = deliveryEndpoints.find((item) => item.method === method && item.path === path)
  if (!endpoint?.handler) throw new Error(`Missing endpoint ${method} ${path}`)
  return endpoint.handler as unknown as (request: TestRequest) => Promise<Response>
}

describe('entrega endpoints', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await handler('get', '/entregas')({ url: 'http://localhost/api/entregas' })
    expect(response.status).toBe(401)
  })

  it('rejects non-admin roles', async () => {
    for (const roles of [['stock'], ['administracion']]) {
      const response = await handler('get', '/entregas')({
        url: 'http://localhost/api/entregas',
        user: { roles },
      })
      expect(response.status).toBe(403)
    }
  })
})
