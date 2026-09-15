import type { PayloadRequest } from 'payload'

import { getContribuyenteById } from '@/integrations/padron/san-benito-client'
import type { Contribuyente } from '@/lib/contribuyente-map'
import { getRoles, hasRole } from '../access/roles'
import { recordStockMovement, type InventoryRequest } from '../inventory/stock-service'
import type {
  BundleVersion,
  Delivery,
  FamilyGroup,
  GroupMember,
  Product,
  ProductLot,
  StockBalance,
  User,
} from '../payload-types'
import { DeliveryError } from './errors'
import type { ConfirmDeliveryInput, ProposalInput, ProposedLine } from './types'
import {
  assertRecipeDiffReason,
  expandProposalLines,
  parseConfirmDeliveryInput,
  parseProposalInput,
  totalsByProduct,
} from './validation'

export { DeliveryError }

export type DeliveryRequest = PayloadRequest & {
  user?: User | null
}

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null

function relationId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') return value.id
  throw new DeliveryError('INTERNAL_ERROR', 'Relación inválida en datos de entrega.', 500)
}

function balanceKey(productId: string, lotId?: string): string {
  return `${productId}:${lotId ?? 'general'}`
}

function assertAdmin(req: DeliveryRequest): User {
  if (!req.user) throw new DeliveryError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)
  if (!hasRole(req.user, 'admin')) {
    throw new DeliveryError('FORBIDDEN', 'Solo el Administrador puede confirmar entregas.', 403)
  }
  return req.user
}

async function auditDeliveryAction(
  req: DeliveryRequest,
  actor: User,
  data: {
    action: string
    after?: JsonValue
    before?: JsonValue
    context?: JsonValue
    reason?: string
    result: 'success' | 'replayed' | 'rejected'
    targetId: string
    targetType: string
  },
): Promise<void> {
  await req.payload.create({
    collection: 'audit-logs',
    data: {
      action: data.action,
      actor: actor.id,
      actorRoles: getRoles(actor),
      after: data.after,
      before: data.before,
      context: data.context,
      module: 'deliveries',
      reason: data.reason,
      result: data.result,
      targetId: data.targetId,
      targetType: data.targetType,
    },
    overrideAccess: true,
    req,
  })
}

async function assertContributorExists(contributorId: string): Promise<Contribuyente> {
  try {
    const { doc: contributor } = await getContribuyenteById(contributorId)
    if (!contributor?.id) {
      throw new DeliveryError('NOT_FOUND', 'El contribuyente no existe en el padrón.', 404)
    }
    return contributor
  } catch (error) {
    if (error instanceof DeliveryError) throw error
    throw new DeliveryError('NOT_FOUND', 'El contribuyente no existe en el padrón.', 404)
  }
}

async function getActiveGroup(req: DeliveryRequest, groupId: string): Promise<FamilyGroup> {
  let group: FamilyGroup
  try {
    group = (await req.payload.findByID({
      collection: 'family-groups',
      depth: 0,
      id: groupId,
      overrideAccess: true,
      req,
    })) as FamilyGroup
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Grupo familiar no encontrado.', 404)
  }
  if (!group) throw new DeliveryError('NOT_FOUND', 'Grupo familiar no encontrado.', 404)
  if (group.status !== 'active') {
    throw new DeliveryError('CONFLICT', 'No se puede entregar a un grupo inactivo.', 409)
  }
  return group
}

async function getActiveMembers(req: DeliveryRequest, groupId: string): Promise<GroupMember[]> {
  const result = await req.payload.find({
    collection: 'group-members',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
    where: {
      and: [{ group: { equals: groupId } }, { status: { equals: 'active' } }],
    },
  })
  return result.docs as GroupMember[]
}

async function getBundleVersion(req: DeliveryRequest, bundleVersionId: string): Promise<BundleVersion> {
  try {
    return (await req.payload.findByID({
      collection: 'bundle-versions',
      depth: 0,
      id: bundleVersionId,
      overrideAccess: true,
      req,
    })) as BundleVersion
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Versión de bolsón no encontrada.', 404)
  }
}

async function getProduct(req: DeliveryRequest, productId: string): Promise<Product> {
  try {
    return (await req.payload.findByID({
      collection: 'products',
      depth: 0,
      id: productId,
      overrideAccess: true,
      req,
    })) as Product
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Producto no encontrado.', 404)
  }
}

async function getLot(req: DeliveryRequest, lotId: string): Promise<ProductLot> {
  try {
    return (await req.payload.findByID({
      collection: 'product-lots',
      depth: 0,
      id: lotId,
      overrideAccess: true,
      req,
    })) as ProductLot
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Lote no encontrado.', 404)
  }
}

async function getBalance(req: DeliveryRequest, productId: string, lotId?: string): Promise<number> {
  const result = await req.payload.find({
    collection: 'stock-balances',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { balanceKey: { equals: balanceKey(productId, lotId) } },
  })
  const balance = result.docs[0] as StockBalance | undefined
  return balance?.quantity ?? 0
}

export type ProposalLineView = ProposedLine & {
  productName: string
  tracksLotExpiration: boolean
  availableQuantity: number
  lots: { id: string; code: string; expirationDate: string; quantity: number }[]
}

export async function buildProposal(
  req: DeliveryRequest,
  input: unknown,
): Promise<{ lines: ProposalLineView[] }> {
  assertAdmin(req)
  const parsed: ProposalInput = parseProposalInput(input)

  const versions = new Map<string, BundleVersion>()
  for (const bundle of parsed.bundles) {
    if (!versions.has(bundle.bundleVersionId)) {
      versions.set(bundle.bundleVersionId, await getBundleVersion(req, bundle.bundleVersionId))
    }
  }

  const expanded = expandProposalLines(parsed, (bundleVersionId) => {
    const version = versions.get(bundleVersionId)
    if (!version) throw new DeliveryError('NOT_FOUND', 'Versión de bolsón no encontrada.', 404)
    return version.lines.map((line) => ({
      productId: relationId(line.product),
      quantity: line.quantity,
    }))
  })

  const productIds = Array.from(new Set(expanded.map((line) => line.productId)))
  const products = new Map<string, Product>()
  for (const productId of productIds) {
    products.set(productId, await getProduct(req, productId))
  }

  const lotsResult = await req.payload.find({
    collection: 'product-lots',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
    where: { product: { in: productIds } },
  })
  const lots = lotsResult.docs as ProductLot[]
  const todayKey = new Date().toISOString().slice(0, 10)

  const lines: ProposalLineView[] = []
  for (const line of expanded) {
    const product = products.get(line.productId)
    if (!product) throw new DeliveryError('NOT_FOUND', 'Producto no encontrado.', 404)

    const productLots = lots.filter((lot) => relationId(lot.product) === product.id && lot.isActive)
    const lotsWithStock = await Promise.all(
      productLots.map(async (lot) => ({
        id: lot.id,
        code: lot.code,
        expirationDate: lot.expirationDate,
        quantity: await getBalance(req, product.id, lot.id),
      })),
    )

    const availableQuantity = product.tracksLotExpiration
      ? lotsWithStock
          .filter((lot) => lot.expirationDate.slice(0, 10) >= todayKey)
          .reduce((total, lot) => total + lot.quantity, 0)
      : await getBalance(req, product.id)

    lines.push({
      ...line,
      productName: product.name,
      tracksLotExpiration: product.tracksLotExpiration,
      availableQuantity,
      lots: lotsWithStock,
    })
  }

  return { lines }
}

async function validateLineLot(
  req: DeliveryRequest,
  product: Product,
  lotId: string | undefined,
  deliveryDate: string,
): Promise<void> {
  if (product.tracksLotExpiration) {
    if (!lotId) {
      throw new DeliveryError('VALIDATION_ERROR', `El producto ${product.name} exige seleccionar un lote.`, 422)
    }
    const lot = await getLot(req, lotId)
    if (relationId(lot.product) !== product.id) {
      throw new DeliveryError('VALIDATION_ERROR', 'El lote no pertenece al producto seleccionado.', 422)
    }
    if (!lot.isActive) {
      throw new DeliveryError('CONFLICT', 'No se puede entregar un lote inactivo.', 409)
    }
    if (lot.expirationDate.slice(0, 10) < deliveryDate) {
      throw new DeliveryError('CONFLICT', 'No se puede entregar un lote vencido.', 409)
    }
    return
  }
  if (lotId) {
    throw new DeliveryError('VALIDATION_ERROR', `El producto ${product.name} no usa lotes.`, 422)
  }
}

export type HydratedDelivery = {
  delivery: Delivery
  bundleCount: number
  lineCount: number
  totalUnits: number
}

export async function getDeliveryById(req: DeliveryRequest, deliveryId: string): Promise<HydratedDelivery> {
  assertAdmin(req)
  let delivery: Delivery
  try {
    delivery = (await req.payload.findByID({
      collection: 'deliveries',
      depth: 0,
      id: deliveryId,
      overrideAccess: true,
      req,
    })) as Delivery
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Entrega no encontrada.', 404)
  }
  if (!delivery) throw new DeliveryError('NOT_FOUND', 'Entrega no encontrada.', 404)

  const [bundlesResult, linesResult] = await Promise.all([
    req.payload.find({
      collection: 'delivery-bundles',
      depth: 0,
      limit: 100,
      overrideAccess: true,
      req,
      where: { delivery: { equals: delivery.id } },
    }),
    req.payload.find({
      collection: 'delivery-lines',
      depth: 0,
      limit: 500,
      overrideAccess: true,
      req,
      where: { delivery: { equals: delivery.id } },
    }),
  ])

  const lines = linesResult.docs as { quantity: number }[]
  return {
    delivery,
    bundleCount: bundlesResult.totalDocs,
    lineCount: linesResult.totalDocs,
    totalUnits: lines.reduce((total, line) => total + line.quantity, 0),
  }
}

export async function listDeliveries(
  req: DeliveryRequest,
  options: { page: number; limit: number },
): Promise<{ docs: HydratedDelivery[]; totalDocs: number; page: number; totalPages: number; limit: number }> {
  assertAdmin(req)
  const result = await req.payload.find({
    collection: 'deliveries',
    depth: 1,
    limit: options.limit,
    overrideAccess: true,
    page: options.page,
    req,
    sort: '-confirmedAt',
  })
  const docs = await Promise.all(
    (result.docs as Delivery[]).map(async (delivery) => {
      const linesResult = await req.payload.find({
        collection: 'delivery-lines',
        depth: 0,
        limit: 500,
        overrideAccess: true,
        req,
        where: { delivery: { equals: delivery.id } },
      })
      const bundlesResult = await req.payload.find({
        collection: 'delivery-bundles',
        depth: 0,
        limit: 100,
        overrideAccess: true,
        req,
        where: { delivery: { equals: delivery.id } },
      })
      const lines = linesResult.docs as { quantity: number }[]
      return {
        delivery,
        bundleCount: bundlesResult.totalDocs,
        lineCount: linesResult.totalDocs,
        totalUnits: lines.reduce((total, line) => total + line.quantity, 0),
      }
    }),
  )
  return {
    docs,
    totalDocs: result.totalDocs,
    page: result.page ?? options.page,
    totalPages: result.totalPages,
    limit: options.limit,
  }
}

export async function confirmDelivery(req: DeliveryRequest, input: unknown): Promise<HydratedDelivery> {
  const actor = assertAdmin(req)
  const parsed: ConfirmDeliveryInput = parseConfirmDeliveryInput(input)
  const operationKey = parsed.operationKey ?? `delivery-${crypto.randomUUID()}`

  const existing = await req.payload.find({
    collection: 'deliveries',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { operationKey: { equals: operationKey } },
  })
  if (existing.totalDocs > 0) {
    const replayed = existing.docs[0] as Delivery
    await auditDeliveryAction(req, actor, {
      action: 'deliveries.confirmed',
      result: 'replayed',
      targetId: replayed.id,
      targetType: 'delivery',
    })
    return getDeliveryById(req, replayed.id)
  }

  const group = await getActiveGroup(req, parsed.groupId)
  const members = await getActiveMembers(req, group.id)
  const memberIds = new Set(members.map((member) => member.contributorId))

  if (parsed.receiverIsThirdParty) {
    await assertContributorExists(parsed.receiverContributorId)
  } else if (!memberIds.has(parsed.receiverContributorId)) {
    throw new DeliveryError(
      'VALIDATION_ERROR',
      'El receptor debe ser un integrante activo del grupo o un tercero autorizado.',
      422,
    )
  }

  const versions = new Map<string, BundleVersion>()
  for (const bundle of parsed.bundles) {
    if (!versions.has(bundle.bundleVersionId)) {
      versions.set(bundle.bundleVersionId, await getBundleVersion(req, bundle.bundleVersionId))
    }
  }

  const expected =
    parsed.bundles.length > 0
      ? totalsByProduct(
          parsed.bundles.flatMap((bundle) => {
            const version = versions.get(bundle.bundleVersionId)
            if (!version) throw new DeliveryError('NOT_FOUND', 'Versión de bolsón no encontrada.', 404)
            return version.lines.map((line) => ({
              productId: relationId(line.product),
              quantity: line.quantity * bundle.quantity,
            }))
          }),
        )
      : null
  if (expected) {
    assertRecipeDiffReason(expected, parsed.lines, parsed.recipeDiffReason)
  }

  const products = new Map<string, Product>()
  for (const line of parsed.lines) {
    if (!products.has(line.productId)) {
      products.set(line.productId, await getProduct(req, line.productId))
    }
    const product = products.get(line.productId)
    if (!product) throw new DeliveryError('NOT_FOUND', 'Producto no encontrado.', 404)
    if (line.bundleVersionId && !versions.has(line.bundleVersionId)) {
      throw new DeliveryError('VALIDATION_ERROR', 'La línea referencia un bolsón inexistente en la entrega.', 422)
    }
    await validateLineLot(req, product, line.lotId, parsed.deliveryDate)
  }

  for (const line of parsed.lines) {
    const available = await getBalance(req, line.productId, line.lotId)
    if (available < line.quantity) {
      const product = products.get(line.productId)
      throw new DeliveryError(
        'INSUFFICIENT_STOCK',
        `Stock insuficiente para ${product?.name ?? line.productId}. Disponible: ${available}, solicitado: ${line.quantity}.`,
        409,
        { productId: line.productId, lotId: line.lotId, available, requested: line.quantity },
      )
    }
  }

  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID === null) {
    throw new DeliveryError('INTERNAL_ERROR', 'No se pudo iniciar la transacción de entrega.', 500)
  }
  const txReq = { ...req, transactionID } as DeliveryRequest
  const inventoryReq = { ...req, transactionID, user: actor } as unknown as InventoryRequest

  try {
    const delivery = (await txReq.payload.create({
      collection: 'deliveries',
      data: {
        confirmedAt: new Date().toISOString(),
        confirmedBy: actor.id,
        deliveryDate: parsed.deliveryDate,
        group: group.id,
        observations: parsed.observations,
        operationKey,
        receiverAuthorizationReason: parsed.receiverAuthorizationReason,
        receiverContributorId: parsed.receiverContributorId,
        receiverIsThirdParty: parsed.receiverIsThirdParty,
        recipeDiffReason: parsed.recipeDiffReason,
        status: 'confirmed',
      },
      overrideAccess: true,
      req: txReq,
    })) as Delivery

    for (const bundle of parsed.bundles) {
      await txReq.payload.create({
        collection: 'delivery-bundles',
        data: {
          bundleVersion: bundle.bundleVersionId,
          delivery: delivery.id,
          modificationNote: bundle.modificationNote,
          quantity: bundle.quantity,
        },
        overrideAccess: true,
        req: txReq,
      })
    }

    let lineIndex = 0
    for (const line of parsed.lines) {
      lineIndex += 1
      const lineOperationKey = `${operationKey}:line:${lineIndex}`
      const existingLine = await txReq.payload.find({
        collection: 'delivery-lines',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req: txReq,
        where: { operationKey: { equals: lineOperationKey } },
      })
      if (existingLine.totalDocs === 0) {
        await txReq.payload.create({
          collection: 'delivery-lines',
          data: {
            bundleVersion: line.bundleVersionId,
            delivery: delivery.id,
            lot: line.lotId,
            observation: line.observation,
            operationKey: lineOperationKey,
            product: line.productId,
            quantity: line.quantity,
          },
          overrideAccess: true,
          req: txReq,
        })
      }

      const stockResult = await recordStockMovement(inventoryReq, {
        operationKey: lineOperationKey,
        movement: {
          mode: 'exit',
          productId: line.productId,
          ...(line.lotId ? { lotId: line.lotId } : {}),
          operationalDate: parsed.deliveryDate,
          observation: `Entrega a grupo ${group.id}`,
          source: 'delivery',
          quantity: line.quantity,
          reason: 'delivery',
        },
      })
      const movementId = stockResult.movement?.id
      if (movementId) {
        await txReq.payload.update({
          collection: 'stock-movements',
          data: { referenceId: delivery.id, referenceType: 'delivery' },
          id: movementId,
          overrideAccess: true,
          req: txReq,
        })
      }
    }

    await auditDeliveryAction(txReq, actor, {
      action: 'deliveries.confirmed',
      after: { deliveryId: delivery.id, groupId: group.id, lineCount: parsed.lines.length },
      result: 'success',
      targetId: delivery.id,
      targetType: 'delivery',
    })

    await txReq.payload.db.commitTransaction(transactionID)
    return getDeliveryById(req, delivery.id)
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
