import { describe, expect, it } from 'vitest'

import { InventoryError, parseStockCommand } from './validation'

describe('parseStockCommand', () => {
  it('accepts a purchase entry with a positive integer quantity', () => {
    expect(
      parseStockCommand({
        operationKey: 'entry-1',
        movement: {
          mode: 'entry',
          productId: 'product-1',
          quantity: 12,
          reason: 'purchase',
          operationalDate: '2026-09-09',
        },
      }),
    ).toMatchObject({
      operationKey: 'entry-1',
      movement: {
        mode: 'entry',
        quantity: 12,
        reason: 'purchase',
      },
    })
  })

  it('accepts a physical count with zero as a valid quantity', () => {
    expect(
      parseStockCommand({
        operationKey: 'count-1',
        movement: {
          mode: 'physicalCount',
          productId: 'product-1',
          countedQuantity: 0,
          operationalDate: '2026-09-09',
        },
      }).movement,
    ).toMatchObject({ mode: 'physicalCount', countedQuantity: 0 })
  })

  it('rejects an exit that uses an entry-only reason', () => {
    expect(() =>
      parseStockCommand({
        operationKey: 'exit-1',
        movement: {
          mode: 'exit',
          productId: 'product-1',
          quantity: 1,
          reason: 'donation',
          operationalDate: '2026-09-09',
        },
      }),
    ).toThrowError(new InventoryError('VALIDATION_ERROR', 'Reason is not valid for this movement mode', 422))
  })

  it.each([
    { field: 'quantity', value: 0 },
    { field: 'quantity', value: 1.5 },
    { field: 'countedQuantity', value: -1 },
  ])('rejects invalid $field values', ({ field, value }) => {
    const movement = {
      mode: field === 'countedQuantity' ? 'physicalCount' : 'entry',
      productId: 'product-1',
      operationalDate: '2026-09-09',
      reason: 'purchase',
      [field]: value,
    }

    expect(() => parseStockCommand({ operationKey: 'invalid-1', movement })).toThrow(InventoryError)
  })

  it('requires a stable operation key and product id', () => {
    expect(() => parseStockCommand({ movement: {} })).toThrow(InventoryError)
    expect(() =>
      parseStockCommand({
        operationKey: 'entry-2',
        movement: {
          mode: 'entry',
          quantity: 1,
          reason: 'purchase',
          operationalDate: '2026-09-09',
        },
      }),
    ).toThrow(InventoryError)
  })
})
