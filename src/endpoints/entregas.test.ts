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

  it('allows administration users past delivery authorization', async () => {
    const response = await handler('get', '/entregas')({
      url: 'http://localhost/api/entregas?page=1&limit=15',
      user: { roles: ['administracion'] },
    })
    expect(response.status).not.toBe(403)
  })

  it('rejects users without delivery access', async () => {
    const response = await handler('get', '/entregas')({
      url: 'http://localhost/api/entregas',
      user: { roles: ['stock'] },
    })
    expect(response.status).toBe(403)
  })
})
