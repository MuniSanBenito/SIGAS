/**
 * @vitest-environment node
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { recordStockMovement, type InventoryRequest } from '@/inventory/stock-service'
import {
  buildProposal,
  confirmDelivery,
  listDeliveryCatalog,
  listGroupDeliveryHistory,
  returnOrthopedicAssistance,
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
      collection: 'delivery-assistances',
      where: { delivery: { in: createdDeliveryIds.length > 0 ? createdDeliveryIds : ['missing'] } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'delivery-reports',
      where: { delivery: { in: createdDeliveryIds.length > 0 ? createdDeliveryIds : ['missing'] } },
      overrideAccess: true,
    })
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

  it('lists current bundles and active products for administration without opening stock writes', async () => {
    const inactive = await payload.create({
      collection: 'products',
      data: {
        category: categoryId,
        inactiveReason: 'Fuera del catálogo de entrega',
        isActive: false,
        minimumStock: 0,
        name: `Inactive delivery product ${runKey}`,
        tracksLotExpiration: false,
      },
      overrideAccess: true,
    })
    const historical = await payload.create({
      collection: 'bundle-versions',
      data: {
        bundle: bundleId,
        createdBy: actor.id,
        effectiveFrom: '2026-08-01',
        lines: [{ product: product.id, quantity: 1 }],
        status: 'historical',
        version: 99,
      },
      overrideAccess: true,
    })

    const catalog = await listDeliveryCatalog({ payload, user: administrationActor } as unknown as DeliveryRequest)
    expect(catalog.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: product.id, name: product.name, tracksLotExpiration: false })]),
    )
    expect(catalog.products.some((item) => item.id === inactive.id)).toBe(false)
    expect(catalog.bundleVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bundleName: `Delivery bundle ${runKey}`,
          id: bundleVersion.id,
          lines: [expect.objectContaining({ productId: product.id, quantity: 2 })],
          version: 1,
        }),
      ]),
    )
    expect(catalog.bundleVersions.some((item) => item.id === historical.id)).toBe(false)

    await expect(
      listDeliveryCatalog({ payload, user: stockActor } as unknown as DeliveryRequest),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })

    await expect(
      payload.create({
        collection: 'products',
        data: {
          category: categoryId,
          isActive: true,
          minimumStock: 0,
          name: `Blocked product ${runKey}`,
          tracksLotExpiration: false,
        },
        overrideAccess: false,
        user: administrationActor,
      }),
    ).rejects.toThrow()

    await payload.delete({ collection: 'bundle-versions', id: historical.id, overrideAccess: true })
    await payload.delete({ collection: 'products', id: inactive.id, overrideAccess: true })
  })

  it('confirms assistance without stock and a mixed delivery only discounts products', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    const before = await payload.find({
      collection: 'stock-movements',
      limit: 1,
      overrideAccess: true,
      where: { product: { equals: product.id }, reason: { equals: 'delivery' } },
    })

    const assistanceOnly = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-20',
      operationKey: `${runKey}-assist-only`,
      bundles: [],
      lines: [],
      assistances: [
        { kind: 'atmospheric', description: 'Temporal de septiembre' },
        { kind: 'money', description: 'Ayuda extraordinaria', amountPesos: 8000 },
        { kind: 'orthopedic', description: 'Muletas', quantity: 1 },
      ],
    })
    createdDeliveryIds.push(assistanceOnly.delivery.id)

    expect(assistanceOnly.lineCount).toBe(0)
    expect(assistanceOnly.assistanceCount).toBe(3)
    expect(assistanceOnly.assistances.find((item) => item.kind === 'orthopedic')?.loanStatus).toBe('loaned')

    const afterAssistance = await payload.find({
      collection: 'stock-movements',
      limit: 1,
      overrideAccess: true,
      where: { product: { equals: product.id }, reason: { equals: 'delivery' } },
    })
    expect(afterAssistance.totalDocs).toBe(before.totalDocs)

    const balanceBefore = await payload.find({
      collection: 'stock-balances',
      limit: 1,
      overrideAccess: true,
      where: { balanceKey: { equals: `${product.id}:general` } },
    })
    const quantityBefore = balanceBefore.docs[0]?.quantity

    const mixed = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-21',
      operationKey: `${runKey}-mixed`,
      bundles: [],
      lines: [{ productId: product.id, quantity: 1 }],
      assistances: [{ kind: 'funeral', description: 'Cajón estándar', quantity: 1 }],
    })
    createdDeliveryIds.push(mixed.delivery.id)

    const balanceAfter = await payload.find({
      collection: 'stock-balances',
      limit: 1,
      overrideAccess: true,
      where: { balanceKey: { equals: `${product.id}:general` } },
    })
    expect(balanceAfter.docs[0]?.quantity).toBe((quantityBefore ?? 0) - 1)

    const loan = assistanceOnly.assistances.find((item) => item.kind === 'orthopedic')
    const returned = await returnOrthopedicAssistance(req, assistanceOnly.delivery.id, loan?.id ?? '')
    expect(returned.assistances.find((item) => item.id === loan?.id)?.loanStatus).toBe('returned')

    const balanceAfterReturn = await payload.find({
      collection: 'stock-balances',
      limit: 1,
      overrideAccess: true,
      where: { balanceKey: { equals: `${product.id}:general` } },
    })
    expect(balanceAfterReturn.docs[0]?.quantity).toBe(balanceAfter.docs[0]?.quantity)

    await expect(returnOrthopedicAssistance(req, assistanceOnly.delivery.id, loan?.id ?? '')).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
    })
  })

  it('links an optional report and keeps it out of public media', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    const mediaBefore = await payload.find({ collection: 'media', limit: 1, overrideAccess: true })
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const dir = mkdtempSync(path.join(tmpdir(), 'sigas-report-'))
    const filePath = path.join(dir, 'informe.png')
    writeFileSync(filePath, png)
    const report = await payload.create({
      collection: 'delivery-reports',
      data: {},
      filePath,
      overrideAccess: true,
    })

    const confirmed = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-22',
      operationKey: `${runKey}-report`,
      reportId: report.id,
      bundles: [],
      lines: [],
      assistances: [{ kind: 'medication', description: 'Ibuprofeno', quantity: 2 }],
    })
    createdDeliveryIds.push(confirmed.delivery.id)

    expect(confirmed.report?.id).toBe(report.id)
    expect(confirmed.report?.mimeType).toBe('image/png')

    const linked = await payload.findByID({
      collection: 'delivery-reports',
      depth: 0,
      id: report.id,
      overrideAccess: true,
    })
    expect(linked.delivery).toBe(confirmed.delivery.id)

    const mediaAfter = await payload.find({ collection: 'media', limit: 1, overrideAccess: true })
    expect(mediaAfter.totalDocs).toBe(mediaBefore.totalDocs)

    await expect(
      payload.find({
        collection: 'delivery-reports',
        overrideAccess: false,
        user: stockActor,
        where: { id: { equals: report.id } },
      }),
    ).rejects.toThrow()
    rmSync(dir, { force: true, recursive: true })
  })

  it('lists what was delivered to a group and on which date', async () => {
    const req = { payload, user: actor } as unknown as DeliveryRequest
    await recordStockMovement(req as unknown as InventoryRequest, {
      operationKey: `${runKey}-history-entry`,
      movement: {
        mode: 'entry',
        operationalDate: '2026-08-01',
        productId: product.id,
        quantity: 5,
        reason: 'purchase',
      },
    })
    const older = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-08-02',
      operationKey: `${runKey}-history-old`,
      bundles: [{ bundleVersionId: bundleVersion.id, quantity: 1 }],
      lines: [{ productId: product.id, quantity: 2, bundleVersionId: bundleVersion.id }],
    })
    const newer = await confirmDelivery(req, {
      groupId,
      receiverContributorId: 'contrib-1',
      receiverIsThirdParty: false,
      deliveryDate: '2026-09-20',
      operationKey: `${runKey}-history-new`,
      bundles: [],
      lines: [],
      assistances: [{ kind: 'medication', description: 'Ibuprofeno', quantity: 1 }],
    })
    createdDeliveryIds.push(older.delivery.id, newer.delivery.id)

    const history = await listGroupDeliveryHistory(req, groupId)
    const dates = history.docs
      .filter((item) => item.id === older.delivery.id || item.id === newer.delivery.id)
      .map((item) => item.deliveryDate.slice(0, 10))
    expect(dates).toEqual(['2026-09-20', '2026-08-02'])

    const olderItem = history.docs.find((item) => item.id === older.delivery.id)
    expect(olderItem?.lines).toEqual([
      expect.objectContaining({ productName: product.name, quantity: 2 }),
    ])
    expect(olderItem?.bundles).toEqual([
      expect.objectContaining({ name: `Delivery bundle ${runKey}`, quantity: 1 }),
    ])
    expect(history.docs.find((item) => item.id === newer.delivery.id)?.assistances).toEqual([
      expect.objectContaining({ kind: 'medication', description: 'Ibuprofeno', quantity: 1 }),
    ])

    const otherGroup = await payload.create({
      collection: 'family-groups',
      data: { referenteContributorId: 'contrib-other', startedAt: '2026-09-01', status: 'active' },
      overrideAccess: true,
    })
    const otherHistory = await listGroupDeliveryHistory(req, otherGroup.id)
    expect(otherHistory.docs).toEqual([])
    await payload.delete({ collection: 'family-groups', id: otherGroup.id, overrideAccess: true })

    await expect(listGroupDeliveryHistory({ payload, user: stockActor } as unknown as DeliveryRequest, groupId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    })
  })
})
