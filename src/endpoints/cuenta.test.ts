import { describe, expect, it } from 'vitest'

import { accountEndpoints } from './cuenta'

type TestRequest = {
  json?: () => Promise<unknown>
  user?: unknown
}

function handler() {
  const endpoint = accountEndpoints.find((item) => item.method === 'post' && item.path === '/cuenta/contrasena')
  if (!endpoint?.handler) throw new Error('Missing password endpoint')
  return endpoint.handler as unknown as (request: TestRequest) => Promise<Response>
}

describe('account password endpoint', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await handler()({ json: async () => ({}) })
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    })
  })
})
