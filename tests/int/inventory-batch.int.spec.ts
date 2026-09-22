import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { parseStockBatchCommand } from '@/inventory/batch-validation'
import { recordStockMovement, type InventoryRequest } from '@/inventory/stock-service'
import type { Product, User } from '@/payload-types'

describe('inventory batch commands', () => {
  let payload: Payload
  let actor: User
  let productA: Product
  let productB: Product
  let categoryId: string
  const batchKey = `inventory-batch-${Date.now()}`

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const category = await payload.create({
      collection: 'product-categories',
      data: { isActive: true, name: `Batch category ${Date.now()}` },
      overrideAccess: true,
    })
    categoryId = category.id

    actor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['stock'],
        username: `992${Date.now().toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User

    productA = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 0,
        name: `Batch product A ${Date.now()}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })) as Product

    productB = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 0,
        name: `Batch product B ${Date.now()}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })) as Product
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'audit-logs',
      where: { targetId: { in: [productA.id, productB.id, actor.id] } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-movements',
      where: { operationKey: { contains: batchKey } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-balances',
      where: { product: { in: [productA.id, productB.id] } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'products', id: productA.id, overrideAccess: true })
    await payload.delete({ collection: 'products', id: productB.id, overrideAccess: true })
    await payload.delete({ collection: 'product-categories', id: categoryId, overrideAccess: true })
    await payload.delete({ collection: 'users', id: actor.id, overrideAccess: true })
  })

  it('parses and records multiple lines with independent operation keys', async () => {
    const req = { payload, user: actor } as unknown as InventoryRequest
    const command = parseStockBatchCommand({
      batchOperationKey: batchKey,
      lines: [
        {
          lineKey: 'line-a',
          movement: {
            mode: 'entry',
            operationalDate: '2026-09-09',
            productId: productA.id,
            quantity: 4,
            reason: 'purchase',
          },
        },
        {
          lineKey: 'line-b',
          movement: {
            countedQuantity: 2,
            mode: 'physicalCount',
            operationalDate: '2026-09-09',
            productId: productB.id,
          },
        },
      ],
    })

    expect(command.lines).toHaveLength(2)

    for (const line of command.lines) {
      await recordStockMovement(req, {
        movement: line.movement,
        operationKey: `${batchKey}:${line.lineKey}`,
      })
    }

    const balances = await payload.find({
      collection: 'stock-balances',
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { product: { in: [productA.id, productB.id] } },
    })

    const balanceA = balances.docs.find((balance) => String(balance.product) === productA.id)
    const balanceB = balances.docs.find((balance) => String(balance.product) === productB.id)

    expect(balanceA?.quantity).toBe(4)
    expect(balanceB?.quantity).toBe(2)
  })
})
