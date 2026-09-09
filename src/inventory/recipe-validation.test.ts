import { describe, expect, it } from 'vitest'

import { parseRecipeCommand } from './recipe-validation'

describe('parseRecipeCommand', () => {
  it('accepts a recipe with unique positive product lines', () => {
    const result = parseRecipeCommand({
      bundleName: 'Bolsón mensual',
      effectiveFrom: '2026-09-09',
      lines: [
        { productId: 'product-1', quantity: 2 },
        { productId: 'product-2', quantity: 1 },
      ],
    })

    expect(result).toMatchObject({ bundleName: 'Bolsón mensual' })
    expect(result.lines[0]).toEqual({ productId: 'product-1', quantity: 2 })
  })

  it('rejects duplicated product lines and non-positive quantities', () => {
    expect(() =>
      parseRecipeCommand({
        bundleId: 'bundle-1',
        effectiveFrom: '2026-09-09',
        lines: [
          { productId: 'product-1', quantity: 1 },
          { productId: 'product-1', quantity: 2 },
        ],
      }),
    ).toThrow('A recipe cannot contain the same product twice')

    expect(() =>
      parseRecipeCommand({
        bundleId: 'bundle-1',
        effectiveFrom: '2026-09-09',
        lines: [{ productId: 'product-1', quantity: 0 }],
      }),
    ).toThrow('quantity must be a positive integer')
  })

  it('requires either an existing bundle or a new bundle name', () => {
    expect(() =>
      parseRecipeCommand({
        effectiveFrom: '2026-09-09',
        lines: [{ productId: 'product-1', quantity: 1 }],
      }),
    ).toThrow('bundleId or bundleName is required')
  })
})
