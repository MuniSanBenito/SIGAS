import { describe, expect, it } from 'vitest'

import { groupEndpoints } from './grupos'

type TestRequest = {
  user?: unknown
  url: string
}

function handler(method: string, path: string) {
  const endpoint = groupEndpoints.find((item) => item.method === method && item.path === path)
  if (!endpoint?.handler) throw new Error(`Missing endpoint ${method} ${path}`)
  return endpoint.handler as unknown as (request: TestRequest) => Promise<Response>
}

describe('grupo endpoints', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await handler('get', '/grupos')({ url: 'http://localhost/api/grupos' })
    expect(response.status).toBe(401)
  })

  it('rejects authenticated users without an allowed role', async () => {
    const response = await handler('get', '/grupos')({
      url: 'http://localhost/api/grupos',
      user: { roles: ['stock'] },
    })
    expect(response.status).toBe(403)
  })

  it('requires contributorId for membership checks', async () => {
    const response = await handler('get', '/grupos/membresias')({
      url: 'http://localhost/api/grupos/membresias',
      user: { roles: ['administracion'] },
    })
    expect(response.status).toBe(422)
  })
})
