import { InventoryError } from './errors'
import type { StockMovementCommand } from './types'
import { parseStockCommand } from './validation'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InventoryError('VALIDATION_ERROR', `${field} is required`, 422)
  }
  return value.trim()
}

export type BatchStockLineInput = {
  lineKey: string
  movement: StockMovementCommand
}

export type BatchStockCommandInput = {
  batchOperationKey: string
  lines: BatchStockLineInput[]
}

export function parseStockBatchCommand(input: unknown): BatchStockCommandInput {
  if (!isRecord(input)) {
    throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)
  }

  const batchOperationKey = requiredString(input.batchOperationKey ?? input.operationKey, 'batchOperationKey')
  if (batchOperationKey.length > 200) {
    throw new InventoryError('VALIDATION_ERROR', 'batchOperationKey is too long', 422)
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new InventoryError('VALIDATION_ERROR', 'lines must be a non-empty array', 422)
  }

  const lines = input.lines.map((line, index) => {
    if (!isRecord(line)) {
      throw new InventoryError('VALIDATION_ERROR', `lines[${index}] must be an object`, 422)
    }

    const lineKey = requiredString(line.lineKey, 'lineKey')
    if (lineKey.length > 120) {
      throw new InventoryError('VALIDATION_ERROR', 'lineKey is too long', 422)
    }

    const parsed = parseStockCommand({
      movement: line.movement,
      operationKey: `${batchOperationKey}:${lineKey}`,
    })

    return {
      lineKey,
      movement: parsed.movement,
    }
  })

  return { batchOperationKey, lines }
}
