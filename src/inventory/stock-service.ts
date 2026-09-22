import type { PayloadRequest } from 'payload'

import { getRoles } from '../access/roles'
import type { Product, ProductLot, StockBalance, StockMovement, User } from '../payload-types'
import { InventoryError } from './errors'
import { calculateStockResult } from './stock-calculation'
import type { StockCommandInput, StockMovementCommand } from './types'

export type InventoryRequest = PayloadRequest & { user: User }

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

type StockMovementData = Omit<
  StockMovement,
  'createdAt' | 'createdBy' | 'correctionOf' | 'id' | 'lot' | 'product' | 'updatedAt'
> & {
  createdBy: string
  correctionOf?: string
  lot?: string
  product: string
}

export type StockCommandResult = {
  balance: StockBalance | null
  movement: StockMovement | null
  previousQuantity: number
  resultingQuantity: number
  replayed: boolean
}

export type StockCorrectionResult = {
  balance: StockBalance | null
  correctedMovement: StockMovement
  correctionMovement: StockMovement
  previousQuantity: number
  resultingQuantity: number
  replayed: boolean
}

function relationId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') return value.id
  throw new InventoryError('INTERNAL_ERROR', 'Invalid relationship returned by inventory data', 500)
}

function balanceKey(productId: string, lotId?: string): string {
  return `${productId}:${lotId ?? 'general'}`
}

function isEntry(command: StockMovementCommand): command is Extract<StockMovementCommand, { mode: 'entry' }> {
  return command.mode === 'entry'
}

function isExit(command: StockMovementCommand): command is Extract<StockMovementCommand, { mode: 'exit' }> {
  return command.mode === 'exit'
}

async function getProduct(req: InventoryRequest, productId: string): Promise<Product> {
  try {
    return (await req.payload.findByID({
      collection: 'products',
      depth: 0,
      id: productId,
      overrideAccess: true,
      req,
    })) as Product
  } catch {
    throw new InventoryError('NOT_FOUND', 'Product not found', 404)
  }
}

async function getLot(req: InventoryRequest, lotId: string): Promise<ProductLot> {
  try {
    return (await req.payload.findByID({
      collection: 'product-lots',
      depth: 0,
      id: lotId,
      overrideAccess: true,
      req,
    })) as ProductLot
  } catch {
    throw new InventoryError('NOT_FOUND', 'Lot not found', 404)
  }
}

async function validateProductAndLot(
  req: InventoryRequest,
  command: StockMovementCommand,
): Promise<{ lot?: ProductLot; product: Product }> {
  const product = await getProduct(req, command.productId)

  if (isEntry(command) && !product.isActive) {
    throw new InventoryError('CONFLICT', 'Inactive products cannot receive new stock', 409)
  }

  if (product.tracksLotExpiration && !command.lotId) {
    throw new InventoryError('VALIDATION_ERROR', 'A lot is required for this product', 422)
  }
  if (!product.tracksLotExpiration && command.lotId) {
    throw new InventoryError('VALIDATION_ERROR', 'This product does not use lots', 422)
  }

  if (!command.lotId) return { product }

  const lot = await getLot(req, command.lotId)
  if (relationId(lot.product) !== product.id) {
    throw new InventoryError('VALIDATION_ERROR', 'The lot does not belong to the selected product', 422)
  }
  if (!lot.isActive) {
    throw new InventoryError('CONFLICT', 'Inactive lots cannot be used', 409)
  }
  if (isEntry(command) && lot.expirationDate.slice(0, 10) < command.operationalDate) {
    throw new InventoryError('CONFLICT', 'Expired lots cannot receive new stock', 409)
  }

  return { lot, product }
}

async function findBalance(req: InventoryRequest, key: string): Promise<StockBalance | null> {
  const result = await req.payload.find({
    collection: 'stock-balances',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      balanceKey: {
        equals: key,
      },
    },
  })

  return (result.docs[0] as StockBalance | undefined) ?? null
}

async function findReplayedMovement(req: InventoryRequest, operationKey: string): Promise<StockMovement | null> {
  const result = await req.payload.find({
    collection: 'stock-movements',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      operationKey: {
        equals: operationKey,
      },
    },
  })

  return (result.docs[0] as StockMovement | undefined) ?? null
}

async function findReplayedPhysicalCount(req: InventoryRequest, operationKey: string): Promise<{ quantity: number; lotId?: string; productId: string } | null> {
  const result = await req.payload.find({
    collection: 'audit-logs',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { 'context.operationKey': { equals: operationKey } } as never,
  })
  const audit = result.docs[0] as { after?: unknown; context?: unknown; targetId?: string } | undefined
  if (!audit || typeof audit.targetId !== 'string' || typeof audit.after !== 'object' || audit.after === null) return null
  const after = audit.after as { quantity?: unknown }
  const context = audit.context as { lotId?: unknown; productId?: unknown } | undefined
  if (typeof after.quantity !== 'number' || typeof context?.productId !== 'string') return null
  return {
    lotId: typeof context.lotId === 'string' ? context.lotId : undefined,
    productId: context.productId,
    quantity: after.quantity,
  }
}

export async function auditInventoryAction(
  req: InventoryRequest,
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
      module: 'inventory',
      reason: data.reason,
      result: data.result,
      targetId: data.targetId,
      targetType: data.targetType,
    },
    overrideAccess: true,
    req,
  })
}

async function replayResult(req: InventoryRequest, movement: StockMovement): Promise<StockCommandResult> {
  const productId = relationId(movement.product)
  const lotId = movement.lot ? relationId(movement.lot) : undefined
  const balance = await findBalance(req, balanceKey(productId, lotId))

  return {
    balance,
    movement,
    previousQuantity: movement.previousQuantity,
    resultingQuantity: movement.resultingQuantity,
    replayed: true,
  }
}

async function saveBalance(
  req: InventoryRequest,
  productId: string,
  lotId: string | undefined,
  quantity: number,
  current: StockBalance | null,
): Promise<StockBalance> {
  if (current) {
    return (await req.payload.update({
      collection: 'stock-balances',
      data: { quantity },
      id: current.id,
      overrideAccess: true,
      req,
    })) as StockBalance
  }

  return (await req.payload.create({
    collection: 'stock-balances',
    data: {
      balanceKey: balanceKey(productId, lotId),
      lot: lotId,
      product: productId,
      quantity,
    },
    overrideAccess: true,
    req,
  })) as StockBalance
}

function movementData(
  actor: User,
  command: StockCommandInput,
  productId: string,
  lotId: string | undefined,
  previousQuantity: number,
  resultingQuantity: number,
  delta: number,
): StockMovementData {
  const movement = command.movement
  const manualAdjustment =
    (isEntry(movement) || isExit(movement)) && movement.reason === 'adjustment'
  const physicalCount = movement.mode === 'physicalCount'
  const movementType = manualAdjustment || physicalCount ? 'adjustment' : movement.mode

  return {
    adjustmentDirection: movementType === 'adjustment' ? (delta >= 0 ? 'increase' : 'decrease') : undefined,
    adjustmentMode: movementType === 'adjustment' ? (physicalCount ? 'physicalCount' : 'manual') : undefined,
    createdBy: actor.id,
    correctionOf: undefined,
    lot: lotId,
    movementType,
    observation: movement.observation,
    operationalDate: movement.operationalDate,
    operationKey: command.operationKey,
    previousQuantity,
    product: productId,
    quantity: Math.abs(delta),
    reason: physicalCount ? 'physicalCount' : movement.reason,
    resultingQuantity,
    source: movement.source,
    status: 'active',
  }
}

export async function recordStockMovement(req: InventoryRequest, command: StockCommandInput): Promise<StockCommandResult> {
  const replayed = await findReplayedMovement(req, command.operationKey)
  if (replayed) return replayResult(req, replayed)

  const replayedPhysicalCount = await findReplayedPhysicalCount(req, command.operationKey)
  if (replayedPhysicalCount) {
    const balance = await findBalance(req, balanceKey(replayedPhysicalCount.productId, replayedPhysicalCount.lotId))
    return {
      balance,
      movement: null,
      previousQuantity: replayedPhysicalCount.quantity,
      replayed: true,
      resultingQuantity: replayedPhysicalCount.quantity,
    }
  }

  const { lot, product } = await validateProductAndLot(req, command.movement)
  const lotId = lot?.id
  const current = await findBalance(req, balanceKey(product.id, lotId))
  const currentQuantity = current?.quantity ?? 0
  const movement = command.movement

  let delta: number
  if (movement.mode === 'physicalCount') {
    delta = movement.countedQuantity - currentQuantity
  } else if (isEntry(movement)) {
    delta = movement.quantity
  } else if (isExit(movement)) {
    delta = -movement.quantity
  } else {
    throw new InventoryError('VALIDATION_ERROR', 'Unsupported stock movement', 422)
  }

  if (delta === 0) {
    await auditInventoryAction(req, req.user, {
      action: 'stock.physical_count_verified',
      after: { quantity: currentQuantity },
      before: { quantity: currentQuantity },
      context: { lotId: lotId ?? null, operationKey: command.operationKey, productId: product.id },
      result: 'success',
      targetId: product.id,
      targetType: 'product',
    })

    return {
      balance: current,
      movement: null,
      previousQuantity: currentQuantity,
      resultingQuantity: currentQuantity,
      replayed: false,
    }
  }

  const result = calculateStockResult(currentQuantity, delta)
  const savedBalance = await saveBalance(req, product.id, lotId, result.resultingQuantity, current)
  const savedMovement = (await req.payload.create({
    collection: 'stock-movements',
    data: movementData(req.user, command, product.id, lotId, result.previousQuantity, result.resultingQuantity, delta),
    draft: false,
    overrideAccess: true,
    req,
  })) as StockMovement

  await auditInventoryAction(req, req.user, {
    action: 'stock.movement.recorded',
    after: { balance: result.resultingQuantity, movementId: savedMovement.id },
    before: { balance: result.previousQuantity },
    context: { lotId: lotId ?? null, mode: movement.mode, operationKey: command.operationKey, productId: product.id },
    reason: 'reason' in movement ? movement.reason : 'physicalCount',
    result: 'success',
    targetId: savedMovement.id,
    targetType: 'stock-movement',
  })

  return {
    balance: savedBalance,
    movement: savedMovement,
    previousQuantity: result.previousQuantity,
    resultingQuantity: result.resultingQuantity,
    replayed: false,
  }
}

function originalMovementDelta(movement: StockMovement): number {
  if (movement.movementType === 'entry') return movement.quantity
  if (movement.movementType === 'exit') return -movement.quantity
  if (movement.adjustmentDirection === 'increase') return movement.quantity
  if (movement.adjustmentDirection === 'decrease') return -movement.quantity
  throw new InventoryError('INTERNAL_ERROR', 'Unable to determine movement delta', 500)
}

async function getMovement(req: InventoryRequest, movementId: string): Promise<StockMovement> {
  try {
    return (await req.payload.findByID({
      collection: 'stock-movements',
      depth: 0,
      id: movementId,
      overrideAccess: false,
      req,
      user: req.user,
    })) as StockMovement
  } catch {
    throw new InventoryError('NOT_FOUND', 'Movement not found', 404)
  }
}

export async function correctStockMovement(
  req: InventoryRequest,
  movementId: string,
  reason: string,
): Promise<StockCorrectionResult> {
  const operationKey = `correction-${movementId}`
  const replayed = await findReplayedMovement(req, operationKey)
  if (replayed) {
    const original = replayed.correctionOf
      ? ((await req.payload.findByID({
          collection: 'stock-movements',
          depth: 0,
          id: relationId(replayed.correctionOf),
          overrideAccess: true,
          req,
        })) as StockMovement)
      : await getMovement(req, movementId)

    const productId = relationId(replayed.product)
    const lotId = replayed.lot ? relationId(replayed.lot) : undefined
    const balance = await findBalance(req, balanceKey(productId, lotId))

    return {
      balance,
      correctedMovement: original,
      correctionMovement: replayed,
      previousQuantity: replayed.previousQuantity,
      resultingQuantity: replayed.resultingQuantity,
      replayed: true,
    }
  }

  const movement = await getMovement(req, movementId)

  if (movement.status !== 'active') {
    throw new InventoryError('CONFLICT', 'Only active movements can be corrected', 409)
  }
  if (movement.correctionOf) {
    throw new InventoryError('CONFLICT', 'Correction movements cannot be corrected again', 409)
  }
  if (movement.referenceType === 'delivery') {
    throw new InventoryError('CONFLICT', 'Delivery movements must be corrected through delivery annulment', 409)
  }

  const productId = relationId(movement.product)
  const lotId = movement.lot ? relationId(movement.lot) : undefined
  const current = await findBalance(req, balanceKey(productId, lotId))
  const currentQuantity = current?.quantity ?? 0
  const delta = -originalMovementDelta(movement)
  const result = calculateStockResult(currentQuantity, delta)
  const today = new Date().toISOString().slice(0, 10)

  const correctionMovement = (await req.payload.create({
    collection: 'stock-movements',
    data: {
      adjustmentDirection: delta >= 0 ? 'increase' : 'decrease',
      adjustmentMode: 'manual',
      correctionOf: movement.id,
      createdBy: req.user.id,
      lot: lotId,
      movementType: 'adjustment',
      observation: `Corrección de movimiento ${movement.id}`,
      operationalDate: today,
      operationKey,
      previousQuantity: result.previousQuantity,
      product: productId,
      quantity: Math.abs(delta),
      reason,
      resultingQuantity: result.resultingQuantity,
      source: 'correction',
      status: 'active',
    },
    depth: 0,
    draft: false,
    overrideAccess: true,
    req,
  })) as StockMovement

  const correctedMovement = (await req.payload.update({
    collection: 'stock-movements',
    data: { status: 'corrected' },
    depth: 0,
    id: movement.id,
    overrideAccess: true,
    req,
  })) as StockMovement

  const savedBalance = await saveBalance(req, productId, lotId, result.resultingQuantity, current)

  await auditInventoryAction(req, req.user, {
    action: 'stock.movement.corrected',
    after: {
      balance: result.resultingQuantity,
      correctionMovementId: correctionMovement.id,
      originalStatus: 'corrected',
    },
    before: {
      balance: result.previousQuantity,
      movementId: movement.id,
      originalStatus: movement.status,
    },
    context: { lotId: lotId ?? null, operationKey, productId },
    reason,
    result: 'success',
    targetId: movement.id,
    targetType: 'stock-movement',
  })

  return {
    balance: savedBalance,
    correctedMovement,
    correctionMovement,
    previousQuantity: result.previousQuantity,
    resultingQuantity: result.resultingQuantity,
    replayed: false,
  }
}
