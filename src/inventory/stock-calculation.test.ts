import { describe, expect, it } from 'vitest'

import { InventoryError } from './errors'
import { calculateStockResult } from './stock-calculation'

describe('calculateStockResult', () => {
  it('adds an entry to the current balance', () => {
    expect(calculateStockResult(4, 6)).toEqual({ previousQuantity: 4, resultingQuantity: 10 })
  })

  it('allows an exit down to zero', () => {
    expect(calculateStockResult(4, -4)).toEqual({ previousQuantity: 4, resultingQuantity: 0 })
  })

  it('rejects an exit that would make the balance negative', () => {
    expect(() => calculateStockResult(4, -5)).toThrowError(
      new InventoryError('INSUFFICIENT_STOCK', 'Insufficient stock', 409),
    )
  })

  it('rejects an invalid current balance or delta', () => {
    expect(() => calculateStockResult(-1, 1)).toThrow(InventoryError)
    expect(() => calculateStockResult(1, 1.5)).toThrow(InventoryError)
  })
})
