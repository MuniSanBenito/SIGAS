import type { PayloadRequest } from 'payload'

import { getContribuyenteById } from '@/integrations/padron/san-benito-client'
import type { Contribuyente } from '@/lib/contribuyente-map'
import { canAccessModule, getRoles } from '../access/roles'
import { recordStockMovement, type InventoryRequest } from '../inventory/stock-service'
import type {
  Bundle,
  BundleVersion,
  Delivery,
  DeliveryAssistance,
  DeliveryBundle,
  DeliveryLine,
  DeliveryReport,
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

type LotWithStock = {
  id: string
  code: string
  expirationDate: string
  quantity: number
}

async function getLotsWithStockForProduct(
  req: DeliveryRequest,
  product: Product,
  lots: ProductLot[],
): Promise<LotWithStock[]> {
  const productLots = lots.filter((lot) => relationId(lot.product) === product.id && lot.isActive)
  return Promise.all(
    productLots.map(async (lot) => ({
      id: lot.id,
      code: lot.code,
      expirationDate: lot.expirationDate,
      quantity: await getBalance(req, product.id, lot.id),
    })),
  )
}

function availableQuantityFromLots(lotsWithStock: LotWithStock[], asOfDate: string): number {
  return lotsWithStock
    .filter((lot) => lot.expirationDate.slice(0, 10) >= asOfDate)
    .reduce((total, lot) => total + lot.quantity, 0)
}

function allocateLotsFEFO(
  lotsWithStock: LotWithStock[],
  asOfDate: string,
  quantity: number,
): { lotId: string; quantity: number }[] {
  const eligible = lotsWithStock
    .filter((lot) => lot.expirationDate.slice(0, 10) >= asOfDate && lot.quantity > 0)
    .sort((left, right) => left.expirationDate.localeCompare(right.expirationDate))

  const allocations: { lotId: string; quantity: number }[] = []
  let remaining = quantity
  for (const lot of eligible) {
    if (remaining <= 0) break
    const taken = Math.min(lot.quantity, remaining)
    allocations.push({ lotId: lot.id, quantity: taken })
    remaining -= taken
  }
  return allocations
}

function assertDeliveryOperator(req: DeliveryRequest): User {
  if (!req.user) throw new DeliveryError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)
  if (!canAccessModule(req.user, 'deliveries')) {
    throw new DeliveryError('FORBIDDEN', 'No tenés permiso para operar entregas.', 403)
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

export type DeliveryCatalogProduct = {
  id: string
  name: string
  tracksLotExpiration: boolean
}

export type DeliveryCatalogBundle = {
  bundleName: string
  id: string
  lines: { productId: string; productName: string; quantity: number }[]
  version: number
}

export async function listDeliveryCatalog(req: DeliveryRequest): Promise<{
  bundleVersions: DeliveryCatalogBundle[]
  products: DeliveryCatalogProduct[]
}> {
  assertDeliveryOperator(req)

  const productsResult = await req.payload.find({
    collection: 'products',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
    sort: 'name',
    where: { isActive: { equals: true } },
  })
  const activeProducts = productsResult.docs as Product[]

  const versionsResult = await req.payload.find({
    collection: 'bundle-versions',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
    sort: 'version',
    where: { status: { equals: 'current' } },
  })
  const versions = versionsResult.docs as BundleVersion[]
  const bundleIds = Array.from(new Set(versions.map((version) => relationId(version.bundle))))
  const bundlesResult = bundleIds.length
    ? await req.payload.find({
        collection: 'bundles',
        depth: 0,
        limit: bundleIds.length,
        overrideAccess: true,
        req,
        where: { id: { in: bundleIds } },
      })
    : { docs: [] }
  const bundleNameById = new Map(
    (bundlesResult.docs as Bundle[]).filter((bundle) => bundle.isActive).map((bundle) => [bundle.id, bundle.name]),
  )

  const knownProductIds = new Set(activeProducts.map((item) => item.id))
  const missingProductIds = Array.from(
    new Set(
      versions.flatMap((version) => version.lines.map((line) => relationId(line.product))).filter((id) => !knownProductIds.has(id)),
    ),
  )
  const extraProducts = missingProductIds.length
    ? await req.payload.find({
        collection: 'products',
        depth: 0,
        limit: missingProductIds.length,
        overrideAccess: true,
        req,
        where: { id: { in: missingProductIds } },
      })
    : { docs: [] }
  const productNameById = new Map<string, string>()
  for (const item of [...activeProducts, ...(extraProducts.docs as Product[])]) {
    productNameById.set(item.id, item.name)
  }

  return {
    products: activeProducts.map((item) => ({
      id: item.id,
      name: item.name,
      tracksLotExpiration: Boolean(item.tracksLotExpiration),
    })),
    bundleVersions: versions
      .filter((version) => bundleNameById.has(relationId(version.bundle)))
      .map((version) => ({
        bundleName: bundleNameById.get(relationId(version.bundle)) as string,
        id: version.id,
        lines: version.lines.map((line) => {
          const productId = relationId(line.product)
          return {
            productId,
            productName: productNameById.get(productId) ?? productId,
            quantity: line.quantity,
          }
        }),
        version: version.version,
      })),
  }
}

export async function buildProposal(
  req: DeliveryRequest,
  input: unknown,
): Promise<{ lines: ProposalLineView[] }> {
  assertDeliveryOperator(req)
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

    const lotsWithStock = await getLotsWithStockForProduct(req, product, lots)

    const availableQuantity = product.tracksLotExpiration
      ? availableQuantityFromLots(lotsWithStock, todayKey)
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
  if (!lotId) return
  if (!product.tracksLotExpiration) {
    throw new DeliveryError('VALIDATION_ERROR', `El producto ${product.name} no usa lotes.`, 422)
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
}

export type HydratedReport = {
  id: string
  filename?: string | null
  mimeType?: string | null
  url?: string | null
}

export type HydratedDelivery = {
  delivery: Delivery
  bundleCount: number
  lineCount: number
  totalUnits: number
  assistanceCount: number
  assistances: DeliveryAssistance[]
  report: HydratedReport | null
}

function toHydratedReport(report: DeliveryReport | null): HydratedReport | null {
  if (!report) return null
  return {
    id: report.id,
    filename: report.filename,
    mimeType: report.mimeType,
    url: report.url,
  }
}

async function loadReport(req: DeliveryRequest, report: Delivery['report']): Promise<HydratedReport | null> {
  if (!report) return null
  if (typeof report === 'object') return toHydratedReport(report)
  try {
    const doc = (await req.payload.findByID({
      collection: 'delivery-reports',
      depth: 0,
      id: report,
      overrideAccess: true,
      req,
    })) as DeliveryReport
    return toHydratedReport(doc)
  } catch {
    return null
  }
}

async function loadAssistances(req: DeliveryRequest, deliveryId: string): Promise<DeliveryAssistance[]> {
  const result = await req.payload.find({
    collection: 'delivery-assistances',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
    sort: 'createdAt',
    where: { delivery: { equals: deliveryId } },
  })
  return result.docs as DeliveryAssistance[]
}

async function hydrateDelivery(
  req: DeliveryRequest,
  delivery: Delivery,
): Promise<HydratedDelivery> {
  const [bundlesResult, linesResult, assistances, report] = await Promise.all([
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
    loadAssistances(req, delivery.id),
    loadReport(req, delivery.report),
  ])
  const lines = linesResult.docs as { quantity: number }[]
  return {
    delivery,
    bundleCount: bundlesResult.totalDocs,
    lineCount: linesResult.totalDocs,
    totalUnits: lines.reduce((total, line) => total + line.quantity, 0),
    assistanceCount: assistances.length,
    assistances,
    report,
  }
}

export async function getDeliveryById(req: DeliveryRequest, deliveryId: string): Promise<HydratedDelivery> {
  assertDeliveryOperator(req)
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
  return hydrateDelivery(req, delivery)
}

export async function listDeliveries(
  req: DeliveryRequest,
  options: { page: number; limit: number },
): Promise<{ docs: HydratedDelivery[]; totalDocs: number; page: number; totalPages: number; limit: number }> {
  assertDeliveryOperator(req)
  const result = await req.payload.find({
    collection: 'deliveries',
    depth: 1,
    limit: options.limit,
    overrideAccess: true,
    page: options.page,
    req,
    sort: '-confirmedAt',
  })
  const docs = await Promise.all((result.docs as Delivery[]).map((delivery) => hydrateDelivery(req, delivery)))
  return {
    docs,
    totalDocs: result.totalDocs,
    page: result.page ?? options.page,
    totalPages: result.totalPages,
    limit: options.limit,
  }
}

export async function confirmDelivery(req: DeliveryRequest, input: unknown): Promise<HydratedDelivery> {
  const actor = assertDeliveryOperator(req)
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

  if (parsed.reportId) {
    await assertUnlinkedReport(req, parsed.reportId)
  }

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

  const lotControlledIds = Array.from(products.values())
    .filter((product) => product.tracksLotExpiration)
    .map((product) => product.id)
  const lotsByProduct = new Map<string, LotWithStock[]>()
  if (lotControlledIds.length > 0) {
    const lotsResult = await req.payload.find({
      collection: 'product-lots',
      depth: 0,
      limit: 1000,
      overrideAccess: true,
      req,
      where: { product: { in: lotControlledIds } },
    })
    const allLots = lotsResult.docs as ProductLot[]
    for (const productId of lotControlledIds) {
      const product = products.get(productId)
      if (!product) continue
      lotsByProduct.set(productId, await getLotsWithStockForProduct(req, product, allLots))
    }
  }

  for (const line of parsed.lines) {
    const product = products.get(line.productId)
    if (!product) throw new DeliveryError('NOT_FOUND', 'Producto no encontrado.', 404)
    const available = line.lotId
      ? await getBalance(req, line.productId, line.lotId)
      : product.tracksLotExpiration
        ? availableQuantityFromLots(lotsByProduct.get(line.productId) ?? [], parsed.deliveryDate)
        : await getBalance(req, line.productId)
    if (available < line.quantity) {
      throw new DeliveryError(
        'INSUFFICIENT_STOCK',
        `Stock insuficiente para ${product.name}. Disponible: ${available}, solicitado: ${line.quantity}.`,
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
        ...(parsed.reportId ? { report: parsed.reportId } : {}),
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
      const product = products.get(line.productId)
      if (!product) throw new DeliveryError('NOT_FOUND', 'Producto no encontrado.', 404)
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

      const stockExits =
        !line.lotId && product.tracksLotExpiration
          ? allocateLotsFEFO(lotsByProduct.get(line.productId) ?? [], parsed.deliveryDate, line.quantity).map(
              (allocation, allocationIndex) => ({
                lotId: allocation.lotId,
                quantity: allocation.quantity,
                operationKey: `${lineOperationKey}:alloc:${allocationIndex + 1}`,
              }),
            )
          : [{ lotId: line.lotId, quantity: line.quantity, operationKey: lineOperationKey }]

      for (const stockExit of stockExits) {
        const stockResult = await recordStockMovement(inventoryReq, {
          operationKey: stockExit.operationKey,
          movement: {
            mode: 'exit',
            productId: line.productId,
            ...(stockExit.lotId ? { lotId: stockExit.lotId } : {}),
            operationalDate: parsed.deliveryDate,
            observation: `Entrega a grupo ${group.id}`,
            source: 'delivery',
            quantity: stockExit.quantity,
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
    }

    for (const assistance of parsed.assistances) {
      await txReq.payload.create({
        collection: 'delivery-assistances',
        data: {
          ...(assistance.amountPesos === undefined ? {} : { amountPesos: assistance.amountPesos }),
          delivery: delivery.id,
          description: assistance.description,
          kind: assistance.kind,
          ...(assistance.kind === 'orthopedic' ? { loanStatus: 'loaned' as const } : {}),
          ...(assistance.quantity === undefined ? {} : { quantity: assistance.quantity }),
        },
        overrideAccess: true,
        req: txReq,
      })
    }

    if (parsed.reportId) {
      await txReq.payload.update({
        collection: 'delivery-reports',
        data: { delivery: delivery.id },
        id: parsed.reportId,
        overrideAccess: true,
        req: txReq,
      })
    }

    await auditDeliveryAction(txReq, actor, {
      action: 'deliveries.confirmed',
      after: {
        assistanceCount: parsed.assistances.length,
        deliveryId: delivery.id,
        groupId: group.id,
        lineCount: parsed.lines.length,
        reportId: parsed.reportId ?? null,
      },
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

async function assertUnlinkedReport(req: DeliveryRequest, reportId: string): Promise<void> {
  let report: DeliveryReport
  try {
    report = (await req.payload.findByID({
      collection: 'delivery-reports',
      depth: 0,
      id: reportId,
      overrideAccess: true,
      req,
    })) as DeliveryReport
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Informe no encontrado.', 404)
  }
  if (!report) throw new DeliveryError('NOT_FOUND', 'Informe no encontrado.', 404)
  if (report.delivery) {
    throw new DeliveryError('CONFLICT', 'El informe ya está vinculado a una entrega.', 409)
  }
}

export async function returnOrthopedicAssistance(
  req: DeliveryRequest,
  deliveryId: string,
  assistanceId: string,
): Promise<HydratedDelivery> {
  const actor = assertDeliveryOperator(req)
  await getDeliveryById(req, deliveryId)

  let assistance: DeliveryAssistance
  try {
    assistance = (await req.payload.findByID({
      collection: 'delivery-assistances',
      depth: 0,
      id: assistanceId,
      overrideAccess: true,
      req,
    })) as DeliveryAssistance
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Asistencia no encontrada.', 404)
  }
  if (!assistance || relationId(assistance.delivery) !== deliveryId) {
    throw new DeliveryError('NOT_FOUND', 'Asistencia no encontrada.', 404)
  }
  if (assistance.kind !== 'orthopedic') {
    throw new DeliveryError('VALIDATION_ERROR', 'Solo un préstamo ortopédico se puede devolver.', 422)
  }
  if (assistance.loanStatus === 'returned') {
    throw new DeliveryError('CONFLICT', 'El elemento ya fue devuelto.', 409)
  }

  const returnedAt = new Date().toISOString()
  await req.payload.update({
    collection: 'delivery-assistances',
    data: { loanStatus: 'returned', returnedAt },
    id: assistance.id,
    overrideAccess: true,
    req,
  })
  await auditDeliveryAction(req, actor, {
    action: 'deliveries.assistance-returned',
    after: { assistanceId: assistance.id, loanStatus: 'returned', returnedAt },
    before: { loanStatus: assistance.loanStatus ?? 'loaned' },
    result: 'success',
    targetId: deliveryId,
    targetType: 'delivery',
  })
  return getDeliveryById(req, deliveryId)
}

export type GroupDeliveryHistoryLine = {
  productName: string
  quantity: number
}

export type GroupDeliveryHistoryBundle = {
  name: string
  quantity: number
}

export type GroupDeliveryHistoryAssistance = {
  kind: DeliveryAssistance['kind']
  description: string
  quantity?: number | null
  amountPesos?: number | null
}

export type GroupDeliveryHistoryItem = {
  id: string
  deliveryDate: string
  confirmedAt: string
  lines: GroupDeliveryHistoryLine[]
  bundles: GroupDeliveryHistoryBundle[]
  assistances: GroupDeliveryHistoryAssistance[]
}

export async function listGroupDeliveryHistory(
  req: DeliveryRequest,
  groupId: string,
): Promise<{ docs: GroupDeliveryHistoryItem[] }> {
  assertDeliveryOperator(req)
  const id = groupId.trim()
  if (!id) throw new DeliveryError('VALIDATION_ERROR', 'El grupo es obligatorio.', 422)

  try {
    await req.payload.findByID({
      collection: 'family-groups',
      depth: 0,
      id,
      overrideAccess: true,
      req,
    })
  } catch {
    throw new DeliveryError('NOT_FOUND', 'Grupo no encontrado.', 404)
  }

  const deliveriesResult = await req.payload.find({
    collection: 'deliveries',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
    sort: '-deliveryDate',
    where: { group: { equals: id } },
  })
  const deliveries = deliveriesResult.docs as Delivery[]
  if (deliveries.length === 0) return { docs: [] }

  const deliveryIds = deliveries.map((delivery) => delivery.id)
  const [linesResult, bundlesResult, assistancesResult] = await Promise.all([
    req.payload.find({
      collection: 'delivery-lines',
      depth: 0,
      limit: 1000,
      overrideAccess: true,
      req,
      where: { delivery: { in: deliveryIds } },
    }),
    req.payload.find({
      collection: 'delivery-bundles',
      depth: 0,
      limit: 500,
      overrideAccess: true,
      req,
      where: { delivery: { in: deliveryIds } },
    }),
    req.payload.find({
      collection: 'delivery-assistances',
      depth: 0,
      limit: 500,
      overrideAccess: true,
      req,
      sort: 'createdAt',
      where: { delivery: { in: deliveryIds } },
    }),
  ])

  const lines = linesResult.docs as DeliveryLine[]
  const bundles = bundlesResult.docs as DeliveryBundle[]
  const assistances = assistancesResult.docs as DeliveryAssistance[]
  const [productNames, bundleNames] = await Promise.all([
    loadProductNames(req, lines.map((line) => relationId(line.product))),
    loadBundleNames(req, bundles.map((bundle) => relationId(bundle.bundleVersion))),
  ])

  const docs = deliveries
    .map((delivery) => ({
      id: delivery.id,
      deliveryDate: delivery.deliveryDate,
      confirmedAt: delivery.confirmedAt,
      lines: lines
        .filter((line) => relationId(line.delivery) === delivery.id)
        .map((line) => ({
          productName: productNames.get(relationId(line.product)) ?? 'Producto',
          quantity: line.quantity,
        })),
      bundles: bundles
        .filter((bundle) => relationId(bundle.delivery) === delivery.id)
        .map((bundle) => ({
          name: bundleNames.get(relationId(bundle.bundleVersion)) ?? 'Bolsón',
          quantity: bundle.quantity,
        })),
      assistances: assistances
        .filter((assistance) => relationId(assistance.delivery) === delivery.id)
        .map((assistance) => ({
          kind: assistance.kind,
          description: assistance.description,
          quantity: assistance.quantity,
          amountPesos: assistance.amountPesos,
        })),
    }))
    .sort((left, right) => {
      const byDate = right.deliveryDate.localeCompare(left.deliveryDate)
      if (byDate !== 0) return byDate
      return right.confirmedAt.localeCompare(left.confirmedAt)
    })

  return { docs }
}

async function loadProductNames(req: DeliveryRequest, productIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(productIds)]
  if (ids.length === 0) return new Map()
  const result = await req.payload.find({
    collection: 'products',
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
    req,
    where: { id: { in: ids } },
  })
  return new Map((result.docs as Product[]).map((product) => [product.id, product.name]))
}

async function loadBundleNames(req: DeliveryRequest, versionIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(versionIds)]
  if (ids.length === 0) return new Map()
  const versionsResult = await req.payload.find({
    collection: 'bundle-versions',
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
    req,
    where: { id: { in: ids } },
  })
  const versions = versionsResult.docs as BundleVersion[]
  const bundleIds = [...new Set(versions.map((version) => relationId(version.bundle)))]
  const bundlesResult = bundleIds.length
    ? await req.payload.find({
        collection: 'bundles',
        depth: 0,
        limit: bundleIds.length,
        overrideAccess: true,
        req,
        where: { id: { in: bundleIds } },
      })
    : { docs: [] as Bundle[] }
  const names = new Map((bundlesResult.docs as Bundle[]).map((bundle) => [bundle.id, bundle.name]))
  return new Map(versions.map((version) => [version.id, names.get(relationId(version.bundle)) ?? `Versión ${version.version}`]))
}
