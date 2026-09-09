import { InventoryError } from './errors'
import { entryReasons, exitReasons, type StockCommandInput, type StockMovementCommand } from './types'

export { InventoryError }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InventoryError('VALIDATION_ERROR', `${field} is required`, 422)
  }

  return value.trim()
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new InventoryError('VALIDATION_ERROR', `${field} must be a string`, 422)
  }
  if (value.length > 500) {
    throw new InventoryError('VALIDATION_ERROR', `${field} is too long`, 422)
  }

  return value.trim() || undefined
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new InventoryError('VALIDATION_ERROR', `${field} must be a positive integer`, 422)
  }

  return value
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new InventoryError('VALIDATION_ERROR', `${field} must be a non-negative integer`, 422)
  }

  return value
}

function operationalDate(value: unknown): string {
  const date = requiredString(value, 'operationalDate')
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (!DATE_PATTERN.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new InventoryError('VALIDATION_ERROR', 'operationalDate must be a valid YYYY-MM-DD date', 422)
  }

  return date
}

function baseMovement(input: Record<string, unknown>): Omit<StockMovementCommand, 'mode' | 'quantity' | 'reason' | 'countedQuantity'> {
  return {
    productId: requiredString(input.productId, 'productId'),
    lotId: optionalString(input.lotId, 'lotId'),
    operationalDate: operationalDate(input.operationalDate),
    observation: optionalString(input.observation, 'observation'),
    source: optionalString(input.source, 'source'),
  }
}

function movementReason<T extends string>(value: unknown, reasons: readonly T[]): T {
  if (typeof value !== 'string' || !reasons.includes(value as T)) {
    throw new InventoryError('VALIDATION_ERROR', 'Reason is not valid for this movement mode', 422)
  }

  return value as T
}

export function parseStockCommand(input: unknown): StockCommandInput {
  if (!isRecord(input)) {
    throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)
  }

  const operationKey = requiredString(input.operationKey, 'operationKey')
  if (operationKey.length > 200) {
    throw new InventoryError('VALIDATION_ERROR', 'operationKey is too long', 422)
  }
  if (!isRecord(input.movement)) {
    throw new InventoryError('VALIDATION_ERROR', 'movement is required', 422)
  }

  const movementInput = input.movement
  const base = baseMovement(movementInput)
  const mode = movementInput.mode

  if (mode === 'entry') {
    return {
      operationKey,
      movement: {
        ...base,
        mode,
        quantity: positiveInteger(movementInput.quantity, 'quantity'),
        reason: movementReason(movementInput.reason, entryReasons),
      },
    }
  }

  if (mode === 'exit') {
    return {
      operationKey,
      movement: {
        ...base,
        mode,
        quantity: positiveInteger(movementInput.quantity, 'quantity'),
        reason: movementReason(movementInput.reason, exitReasons),
      },
    }
  }

  if (mode === 'physicalCount') {
    return {
      operationKey,
      movement: {
        ...base,
        mode,
        countedQuantity: nonNegativeInteger(movementInput.countedQuantity, 'countedQuantity'),
      },
    }
  }

  throw new InventoryError('VALIDATION_ERROR', 'movement.mode is not supported', 422)
}
