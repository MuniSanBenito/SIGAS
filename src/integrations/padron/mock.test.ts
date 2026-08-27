import { describe, expect, it } from 'vitest'

import { createMockPadronAdapter } from './mock'

const existingContributor = {
  id: 'mun-001',
  dni: '12.345.678',
  cuit: '20-12345678-3',
  firstName: 'Ana',
  lastName: 'Pérez',
  address: 'Calle 1 123',
  neighborhood: 'Centro',
  isActive: true,
}

const newContributor = {
  dni: '00.123-456',
  cuit: '27-00123456-4',
  firstName: 'Luis',
  lastName: 'Gómez',
  address: 'Calle 2 456',
  neighborhood: 'Norte',
}

describe('MockPadronAdapter', () => {
  it('searches by normalized DNI, name, and active status', async () => {
    const adapter = createMockPadronAdapter({ contributors: [existingContributor] })

    const result = await adapter.search({
      dni: '12 345-678',
      isActive: true,
    })

    expect(result.status).toBe('confirmada')
    expect(result.history).toEqual(['solicitada', 'confirmada'])
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'mun-001',
        dni: '12345678',
        firstName: 'Ana',
      }),
    ])
  })

  it('rejects invalid and unknown searches with structured errors', async () => {
    const adapter = createMockPadronAdapter()

    const invalid = await adapter.search({ dni: '12/345/678' })
    const unknown = await adapter.search({ dni: '99.999.999' })

    expect(invalid).toMatchObject({
      status: 'rechazada',
      error: { code: 'INVALID_INPUT' },
      history: ['solicitada', 'rechazada'],
    })
    expect(unknown).toMatchObject({
      status: 'rechazada',
      error: { code: 'NOT_FOUND' },
      history: ['solicitada', 'rechazada'],
    })
  })

  it('creates a normalized contributor idempotently', async () => {
    const adapter = createMockPadronAdapter()

    const first = await adapter.create(newContributor, { idempotencyKey: 'create-luis' })
    const repeated = await adapter.create(newContributor, { idempotencyKey: 'create-luis' })
    const search = await adapter.search({ dni: '00123456' })

    expect(first.status).toBe('confirmada')
    expect(first.history).toEqual(['solicitada', 'confirmada'])
    expect(first.data?.dni).toBe('00123456')
    expect(repeated.data?.id).toBe(first.data?.id)
    expect(search.data).toHaveLength(1)
  })

  it('rejects duplicate DNI or CUIT without replacing the existing contributor', async () => {
    const adapter = createMockPadronAdapter({ contributors: [existingContributor] })

    const result = await adapter.create(
      {
        ...newContributor,
        dni: '12345678',
        cuit: '20-12345678-3',
      },
      { idempotencyKey: 'create-duplicate' },
    )

    expect(result).toMatchObject({
      status: 'rechazada',
      error: { code: 'DUPLICATE' },
      history: ['solicitada', 'rechazada'],
    })

    const search = await adapter.search({ dni: '12345678' })
    expect(search.data).toEqual([expect.objectContaining({ id: 'mun-001' })])
  })

  it('updates and deactivates a contributor', async () => {
    const adapter = createMockPadronAdapter({ contributors: [existingContributor] })

    const updated = await adapter.update(
      'mun-001',
      { address: 'Calle 9 999', dni: '00.111.222' },
      { idempotencyKey: 'update-ana' },
    )
    const deactivated = await adapter.deactivate('mun-001', {
      idempotencyKey: 'deactivate-ana',
    })

    expect(updated.status).toBe('confirmada')
    expect(updated.data).toMatchObject({ dni: '00111222', address: 'Calle 9 999' })
    expect(deactivated.data).toMatchObject({ id: 'mun-001', isActive: false })
  })

  it('returns the complete lifecycle for rejected and uncertain writes without mutating memory', async () => {
    const rejectedAdapter = createMockPadronAdapter({ writeStatus: 'rechazada' })
    const uncertainAdapter = createMockPadronAdapter({ writeStatus: 'incierta' })

    const rejected = await rejectedAdapter.create(newContributor, {
      idempotencyKey: 'rejected-create',
    })
    const uncertain = await uncertainAdapter.create(newContributor, {
      idempotencyKey: 'uncertain-create',
    })

    expect(rejected).toMatchObject({
      status: 'rechazada',
      history: ['solicitada', 'rechazada'],
    })
    expect(uncertain).toMatchObject({
      status: 'incierta',
      history: ['solicitada', 'incierta'],
    })
    expect((await rejectedAdapter.search({ dni: '00123456' })).data).toEqual([])
    expect((await uncertainAdapter.search({ dni: '00123456' })).data).toEqual([])
  })
})
