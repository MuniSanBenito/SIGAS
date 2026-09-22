import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { recordStockMovement, type InventoryRequest } from '@/inventory/stock-service'
import {
  buildProposal,
  confirmDelivery,
  type DeliveryRequest,
} from '@/deliveries/delivery-service'
import type { BundleVersion, Product, User } from '@/payload-types'

vi.mock('@/integrations/padron/san-benito-client', () => ({
  getContribuyenteById: vi.fn(async (id: string) => ({
    doc: {
      id,
      nombre: id === 'contrib-9' ? 'Tercera Autorizada' : 'Ana Referente',
      numero_documento: '30111222',
      domicilio: 'Calle 1',
      barrio: 'Centro',
    },
  })),
}))

describe('deliveries service', () => {
  let payload: Payload
  let actor: User
  let stockActor: User
  let administrationActor: User
  let product: Product
  let categoryId: string
  let bundleVersion: BundleVersion
  let bundleId: string
  let groupId: string
  const runKey = `delivery-int-${Date.now()}`
  const createdDeliveryIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    actor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['admin'],
        username: `993${Date.now().toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User

    stockActor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['stock'],
        username: `994${Date.now().toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User

    administrationActor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['administracion'],
        username: `995${Date.now().toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User

    const category = await payload.create({
      collection: 'product-categories',
      data: { isActive: true, name: `Delivery category ${runKey}` },
      overrideAccess: true,
    })
    categoryId = category.id

    product = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 0,
        name: `Delivery product ${runKey}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })) as Product

    const inventoryReq = { payload, user: actor } as unknown as InventoryRequest
    await recordStockMovement(inventoryReq, {
      operationKey: `${runKey}-entry`,
      movement: {
        mode: 'entry',
        operationalDate: '2026-09-01',
        productId: product.id,
        quantity: 10,
        reason: 'purchase',
      },
    })

    const bundle = await payload.create({
      collection: 'bundles',
      data: { isActive: true, name: `Delivery bundle ${runKey}` },
      overrideAccess: true,
    })
    bundleId = bundle.id

    bundleVersion = (await payload.create({
      collection: 'bundle-versions',
      data: {
        bundle: bundleId,
        createdBy: actor.id,
        effectiveFrom: '2026-09-01',
        lines: [{ product: product.id, quantity: 2 }],
        status: 'current',
        version: 1,
      },
      overrideAccess: true,
    })) as BundleVersion

    const kinship = await payload.create({
      collection: 'kinship-relations',
      data: { code: `referente-${runKey}`, isActive: true, label: 'Referente', requiresObservation: false, sortOrder: 1 },
      overrideAccess: true,
    })

    const group = await payload.create({
      collection: 'family-groups',
      data: {
        referenteContributorId: 'contrib-1',
        startedAt: '2026-09-01',
        status: 'active',
      },
      overrideAccess: true,
    })
    groupId = group.id

    await payload.create({
      collection: 'group-members',
      data: {
        contributorId: 'contrib-1',
        group: groupId,
        isReferent: true,
        kinship: kinship.id,
        startedAt: '2026-09-01',
        status: 'active',
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    if (!payload) return
    await payload.delete({
      collection: 'delivery-lines',
      where: { operationKey: { contains: runKey } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'delivery-bundles',
      where: { delivery: { in: createdDeliveryIds } },
      overrideAccess: true,
    })
    for (const id of createdDeliveryIds) {
      await payload.delete({ collection: 'deliveries', id, overrideAccess: true })
    }
    await payload.delete({
      collection: 'audit-logs',
      where: { targetId: { in: createdDeliveryIds } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-movements',
      where: { operationKey: { contains: runKey } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-balances',
      where: { product: { equals: product.id } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'bundle-versions', id: bundleVersion.id, overrideAccess: true })
    await payload.delete({ collection: 'bundles', id: bundleId, overrideAccess: true })
    await payload.delete({
      collection: 'group-members',
      where: { group: { equals: groupId } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'family-groups', id: groupId, overrideAccess: true })
    await payload.delete({
      collection: 'kinship-relations',
      where: { code: { equals: `referente-${runKey}` } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
    await payload.delete({ collection: 'product-categories', id: categoryId, overrideAccess: true })
    await payload.delete({ collection: 'users', id: actor.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: stockActor.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: administrationActor.id, overrideAccess: true })
  })

  it('builds a proposal expanding the recipe with availability', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    const proposal = await buildProposal(req, {
      bundles: [{ bundleVersionId: bundleVersion.id, quantity: 2 }],
      looseProducts: [],
    })

    expect(proposal.lines).toHaveLength(1)
    expect(proposal.lines[0]).toMatchObject({
      productId: product.id,
      quantity: 4,
      availableQuantity: 10,
    })
  })

  it('confirms a delivery to a group and discounts real lines from stock', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    const confirmed = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-15',
      operationKey: `${runKey}-confirm-1`,
      bundles: [{ bundleVersionId: bundleVersion.id, quantity: 2 }],
      lines: [{ productId: product.id, quantity: 4, bundleVersionId: bundleVersion.id }],
    })
    createdDeliveryIds.push(confirmed.delivery.id)

    expect(confirmed.lineCount).toBe(1)
    expect(confirmed.totalUnits).toBe(4)

    const balance = await payload.find({
      collection: 'stock-balances',
      limit: 1,
      overrideAccess: true,
      where: { balanceKey: { equals: `${product.id}:general` } },
    })
    expect(balance.docs[0]?.quantity).toBe(6)

    const movements = await payload.find({
      collection: 'stock-movements',
      limit: 10,
      overrideAccess: true,
      where: { operationKey: { contains: `${runKey}-confirm-1` } },
    })
    expect(movements.totalDocs).toBe(1)
    expect(movements.docs[0]).toMatchObject({
      reason: 'delivery',
      referenceType: 'delivery',
      referenceId: confirmed.delivery.id,
    })
  })

  it('rejects confirmation without stock and persists nothing', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    const before = await payload.find({ collection: 'deliveries', limit: 1, overrideAccess: true })

    await expect(
      confirmDelivery(req, {
        groupId,
        receiverContributorId: 'contrib-1',
        receiverIsThirdParty: false,
        deliveryDate: '2026-09-15',
        operationKey: `${runKey}-confirm-short`,
        bundles: [],
        lines: [{ productId: product.id, quantity: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 })

    const after = await payload.find({ collection: 'deliveries', limit: 1, overrideAccess: true })
    expect(after.totalDocs).toBe(before.totalDocs)
  })

  it('always rejects a person destination', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    await expect(
      confirmDelivery(req, {
        groupId,
        destinoTipo: 'persona',
        receiverContributorId: 'contrib-1',
        receiverIsThirdParty: false,
        deliveryDate: '2026-09-15',
        bundles: [],
        lines: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })
  })

  it('rejects non-member receivers and accepts authorized third parties', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    await expect(
      confirmDelivery(req, {
        groupId,
        receiverContributorId: 'contrib-9',
        receiverIsThirdParty: false,
        deliveryDate: '2026-09-15',
        bundles: [],
        lines: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toThrow('integrante activo')

    const confirmed = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-9',
      receiverIsThirdParty: true,
      receiverAuthorizationReason: 'Vecina autorizada por el referente',
      deliveryDate: '2026-09-15',
      operationKey: `${runKey}-confirm-third`,
      bundles: [],
      lines: [{ productId: product.id, quantity: 1 }],
    })
    createdDeliveryIds.push(confirmed.delivery.id)
    expect(confirmed.delivery.receiverIsThirdParty).toBe(true)
  })

  it('forbids stock users from confirming deliveries', async () => {
    const req = { payload, user: stockActor } as unknown as DeliveryRequest
    await expect(
      confirmDelivery(req, {
        groupId,
        receiverContributorId: 'contrib-1',
        receiverIsThirdParty: false,
        deliveryDate: '2026-09-15',
        bundles: [],
        lines: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })

  it('allows administration users to confirm deliveries', async () => {
    const req = { payload, user: administrationActor } as unknown as DeliveryRequest
    const confirmed = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-16',
      operationKey: `${runKey}-confirm-administration`,
      bundles: [],
      lines: [{ productId: product.id, quantity: 1 }],
    })
    createdDeliveryIds.push(confirmed.delivery.id)
    expect(confirmed.delivery.status).toBe('confirmed')
  })

  it(
    'confirms a lot-controlled product without selecting a lot and allocates stock automatically',
    async () => {
    const lotRunKey = `${runKey}-lot`
    const lotProduct = (await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        isActive: true,
        minimumStock: 0,
        name: `Delivery lot product ${lotRunKey}`,
        tracksLotExpiration: true,
      },
      overrideAccess: true,
    })) as Product

    const lot = await payload.create({
      collection: 'product-lots',
      data: {
        code: `LOT-${lotRunKey}`,
        expirationDate: '2026-12-31',
        isActive: true,
        product: lotProduct.id,
      },
      overrideAccess: true,
    })

    const inventoryReq = { payload, user: actor } as unknown as InventoryRequest
    await recordStockMovement(inventoryReq, {
      operationKey: `${lotRunKey}-entry`,
      movement: {
        mode: 'entry',
        lotId: lot.id,
        operationalDate: '2026-09-01',
        productId: lotProduct.id,
        quantity: 5,
        reason: 'purchase',
      },
    })

    const req = { payload, user: actor } as unknown as DeliveryRequest
    const confirmed = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-15',
      operationKey: `${lotRunKey}-confirm`,
      bundles: [],
      lines: [{ productId: lotProduct.id, quantity: 2 }],
    })
    createdDeliveryIds.push(confirmed.delivery.id)

    const balance = await payload.find({
      collection: 'stock-balances',
      limit: 1,
      overrideAccess: true,
      where: { balanceKey: { equals: `${lotProduct.id}:${lot.id}` } },
    })
    expect(balance.docs[0]?.quantity).toBe(3)

    const movements = await payload.find({
      collection: 'stock-movements',
      limit: 10,
      overrideAccess: true,
      where: { operationKey: { contains: `${lotRunKey}-confirm` } },
    })
    expect(movements.totalDocs).toBe(1)
    expect(movements.docs[0]).toMatchObject({
      quantity: 2,
      reason: 'delivery',
    })
    expect(movements.docs[0]?.lot).toEqual(
      expect.objectContaining({ id: lot.id }),
    )

    await payload.delete({
      collection: 'stock-movements',
      where: { operationKey: { contains: lotRunKey } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stock-balances',
      where: { product: { equals: lotProduct.id } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'product-lots', id: lot.id, overrideAccess: true })
    await payload.delete({ collection: 'products', id: lotProduct.id, overrideAccess: true })
    },
    15000,
  )
})
