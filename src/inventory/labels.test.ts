import { describe, expect, it } from 'vitest'

import { inventoryErrorMessage, movementReasonLabel } from './labels'

describe('inventory labels', () => {
  it('maps movement reasons to Spanish labels', () => {
    expect(movementReasonLabel('purchase')).toBe('Compra')
    expect(movementReasonLabel('loss')).toBe('Pérdida')
    expect(movementReasonLabel('physicalCount')).toBe('Conteo')
    expect(movementReasonLabel('unknown')).toBe('Otro')
  })

  it('translates known API error messages', () => {
    expect(inventoryErrorMessage('Insufficient stock')).toBe('No hay suficiente stock.')
    expect(inventoryErrorMessage('quantity must be a positive integer')).toBe(
      'La cantidad debe ser un número entero mayor a cero.',
    )
  })
})
