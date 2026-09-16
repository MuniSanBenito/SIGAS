import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { createRecipe } from '@/inventory/recipe-service'
import { parseRecipeCommand } from '@/inventory/recipe-validation'
import { updateProduct, updateCategory } from '@/inventory/catalog-service'
import { correctStockMovement, recordStockMovement, type InventoryRequest } from '@/inventory/stock-service'
import { parseStockCommand } from '@/inventory/validation'
import type { Product, StockMovement, User } from '@/payload-types'

describe('inventory catalog and corrections', () => {
  let payload: Payload
  let actor: User
  let product: Product
  let secondProduct: Product
  let categoryId: string
  let entryMovement: StockMovement
  const runKey = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const category = await payload.create({
      collection: 'product-categories',
      data: { isActive: true, name: `Catalog category ${runKey}` },
      overrideAccess: true,
    })
    categoryId = category.id

    actor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['stock'],
        username: `992${runKey.toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User

    product = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 2,
        name: `Catalog product ${runKey}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })) as Product

    secondProduct = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 1,
        name: `Catalog product 2 ${runKey}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })) as Product

    const req = { payload, user: actor } as unknown as InventoryRequest
    const entry = await recordStockMovement(
      req,
      parseStockCommand({
        operationKey: `catalog-entry-${runKey}`,
        movement: {
          mode: 'entry',
          operationalDate: '2026-09-09',
          productId: product.id,
          quantity: 5,
          reason: 'purchase',
        },
      }),
    )
    entryMovement = entry.movement as StockMovement
  })

  afterAll(async () => {
    const productIds = [product.id, secondProduct.id]
    await payload.delete({ collection: 'audit-logs', where: { targetId: { in: productIds } }, overrideAccess: true })
    await payload.delete({ collection: 'stock-movements', where: { product: { in: productIds } }, overrideAccess: true })
    await payload.delete({ collection: 'stock-balances', where: { product: { in: productIds } }, overrideAccess: true })
    await payload.delete({ collection: 'bundle-versions', where: { createdBy: { equals: actor.id } }, overrideAccess: true })
    await payload.delete({ collection: 'bundles', where: { name: { contains: `${runKey}` } }, overrideAccess: true })
    for (const id of productIds) await payload.delete({ collection: 'products', id, overrideAccess: true })
    await payload.delete({ collection: 'product-categories', id: categoryId, overrideAccess: true })
    await payload.delete({ collection: 'users', id: actor.id, overrideAccess: true })
  })

  it('updates a product and category with audit trail', async () => {
    const req = { payload, user: actor } as unknown as InventoryRequest
    const updatedProduct = await updateProduct(req, product.id, { minimumStock: 10, name: `Updated product ${runKey}` })
    const updatedCategory = await updateCategory(req, categoryId, { name: `Updated category ${runKey}` })

    expect(updatedProduct.minimumStock).toBe(10)
    expect(updatedCategory.name).toBe(`Updated category ${runKey}`)
  })

  it('corrects an entry movement and restores the previous balance', async () => {
    const req = { payload, user: actor } as unknown as InventoryRequest
    const result = await correctStockMovement(req, entryMovement.id, 'Carga duplicada')

    expect(result.replayed).toBe(false)
    expect(result.correctedMovement.status).toBe('corrected')
    expect(result.correctionMovement.correctionOf).toBe(entryMovement.id)
    expect(result.resultingQuantity).toBe(0)

    const replay = await correctStockMovement(req, entryMovement.id, 'Carga duplicada')
    expect(replay.replayed).toBe(true)
  })

  it('rejects correcting delivery-linked movements', async () => {
    const deliveryMovement = (await payload.create({
      collection: 'stock-movements',
      data: {
        createdBy: actor.id,
        movementType: 'exit',
        operationalDate: '2026-09-09',
        operationKey: `delivery-exit-${runKey}`,
        previousQuantity: 5,
        product: product.id,
        quantity: 1,
        reason: 'delivery',
        referenceId: 'delivery-1',
        referenceType: 'delivery',
        resultingQuantity: 4,
        status: 'active',
      },
      overrideAccess: true,
    })) as StockMovement

    const req = { payload, user: actor } as unknown as InventoryRequest
    await expect(correctStockMovement(req, deliveryMovement.id, 'No permitido')).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
    })
  })

  it('creates a new recipe version without rewriting the previous one', async () => {
    const req = { payload, user: actor } as unknown as InventoryRequest
    const firstVersion = await createRecipe(
      req,
      parseRecipeCommand({
        bundleName: `Bundle ${runKey}`,
        effectiveFrom: '2026-09-01',
        lines: [{ productId: product.id, quantity: 1 }],
      }),
    )
    const secondVersion = await createRecipe(
      req,
      parseRecipeCommand({
        bundleId: typeof firstVersion.bundle === 'string' ? firstVersion.bundle : firstVersion.bundle.id,
        effectiveFrom: '2026-09-15',
        lines: [
          { productId: product.id, quantity: 1 },
          { productId: secondProduct.id, quantity: 2 },
        ],
      }),
    )

    const historical = await payload.findByID({
      collection: 'bundle-versions',
      id: firstVersion.id,
      overrideAccess: true,
    })

    expect(secondVersion.version).toBe(2)
    expect(historical.status).toBe('historical')
    expect(secondVersion.status).toBe('current')
  })
})
