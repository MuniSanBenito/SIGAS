import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { parseStockCommand } from '@/inventory/validation'
import { recordStockMovement, type InventoryRequest } from '@/inventory/stock-service'
import type { Product, User } from '@/payload-types'

describe('inventory stock commands', () => {
  let payload: Payload
  let actor: User
  let product: Product
  let categoryId: string
  const operationKeys = ['inventory-int-entry', 'inventory-int-exit']

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const category = await payload.create({
      collection: 'product-categories',
      data: { isActive: true, name: `Test category ${Date.now()}` },
      overrideAccess: true,
    })
    categoryId = category.id

    actor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['stock'],
        username: `991${Date.now().toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User

    product = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 2,
        name: `Test product ${Date.now()}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })) as Product
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'audit-logs',
      where: { targetId: { in: [product.id, actor.id] } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-movements',
      where: { operationKey: { in: operationKeys } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-balances',
      where: { product: { equals: product.id } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
    await payload.delete({ collection: 'product-categories', id: categoryId, overrideAccess: true })
    await payload.delete({ collection: 'users', id: actor.id, overrideAccess: true })
  })

  it('records an entry and replays the same operation key without duplicating it', async () => {
    const req = { payload, user: actor } as unknown as InventoryRequest
    const command = parseStockCommand({
      operationKey: operationKeys[0],
      movement: {
        mode: 'entry',
        operationalDate: '2026-09-09',
        productId: product.id,
        quantity: 5,
        reason: 'purchase',
      },
    })

    const first = await recordStockMovement(req, command)
    const replay = await recordStockMovement(req, command)

    expect(first).toMatchObject({
      balance: { quantity: 5 },
      movement: { movementType: 'entry', quantity: 5, resultingQuantity: 5 },
      previousQuantity: 0,
      resultingQuantity: 5,
      replayed: false,
    })
    expect(replay).toMatchObject({ balance: { quantity: 5 }, replayed: true })
  })

  it('records an exit and rejects a negative resulting balance', async () => {
    const req = { payload, user: actor } as unknown as InventoryRequest
    const exit = await recordStockMovement(
      req,
      parseStockCommand({
        operationKey: operationKeys[1],
        movement: {
          mode: 'exit',
          operationalDate: '2026-09-09',
          productId: product.id,
          quantity: 2,
          reason: 'loss',
        },
      }),
    )

    expect(exit).toMatchObject({ balance: { quantity: 3 }, movement: { movementType: 'exit' } })

    await expect(
      recordStockMovement(
        req,
        parseStockCommand({
          operationKey: 'inventory-int-too-much',
          movement: {
            mode: 'exit',
            operationalDate: '2026-09-09',
            productId: product.id,
            quantity: 4,
            reason: 'breakage',
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 })

    const balance = await payload.find({
      collection: 'stock-balances',
      overrideAccess: true,
      where: { product: { equals: product.id } },
    })
    expect(balance.docs).toHaveLength(1)
    expect(balance.docs[0].quantity).toBe(3)
  })
})
