import { afterEach, describe, expect, it, vi } from 'vitest'

import { findContribuyentes, getContribuyenteById } from './san-benito-client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('san-benito-client', () => {
  it('adds the server token, selects safe fields, and removes clave_web', async () => {
    vi.stubEnv('EXTERNAL_API_BASE_URL', 'https://sanbenito.gob.ar/api')
    vi.stubEnv('EXTERNAL_API_KEY', 'secret-token')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        docs: [{ id: 'abc', nombre: 'PÉREZ JUAN', clave_web: 'private', numero_documento: 30123456 }],
        totalDocs: 1,
        limit: 15,
        totalPages: 1,
        page: 1,
        hasNextPage: false,
        nextPage: null,
      }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await findContribuyentes(new URLSearchParams({ limit: '15', page: '1' }))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe('https://sanbenito.gob.ar/api/contribuyentes')
    expect(parsed.searchParams.get('select[id]')).toBe('true')
    expect((init.headers as Record<string, string>).token).toBe('secret-token')
    expect(result.docs[0]).toEqual({ id: 'abc', nombre: 'PÉREZ JUAN', numero_documento: '30123456' })
  })

  it('supports the external detail response at the root', async () => {
    vi.stubEnv('EXTERNAL_API_BASE_URL', 'https://sanbenito.gob.ar/api')
    vi.stubEnv('EXTERNAL_API_KEY', 'secret-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc', nombre: 'PÉREZ JUAN', clave_web: 'private' }), { status: 200 }),
    ))

    await expect(getContribuyenteById('abc')).resolves.toEqual({
      doc: { id: 'abc', nombre: 'PÉREZ JUAN' },
    })
  })

  it('translates external errors without exposing the token', async () => {
    vi.stubEnv('EXTERNAL_API_BASE_URL', 'https://sanbenito.gob.ar/api')
    vi.stubEnv('EXTERNAL_API_KEY', 'secret-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401 }),
    ))

    await expect(findContribuyentes(new URLSearchParams())).rejects.toMatchObject({ status: 401 })
  })
})
