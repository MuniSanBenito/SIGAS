import { InventoryError } from './errors'

export function calculateStockResult(currentQuantity: number, delta: number): {
  previousQuantity: number
  resultingQuantity: number
} {
  if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0) {
    throw new InventoryError('VALIDATION_ERROR', 'Current stock must be a non-negative integer', 422)
  }
  if (!Number.isSafeInteger(delta)) {
    throw new InventoryError('VALIDATION_ERROR', 'Stock delta must be an integer', 422)
  }

  const resultingQuantity = currentQuantity + delta
  if (resultingQuantity < 0) {
    throw new InventoryError('INSUFFICIENT_STOCK', 'Insufficient stock', 409)
  }

  return {
    previousQuantity: currentQuantity,
    resultingQuantity,
  }
}
