import { InventoryError } from './errors'
import { validateDateOnly, validatePositiveInteger } from './field-validation'

export type RecipeLineInput = {
  productId: string
  quantity: number
}

export type RecipeCommandInput = {
  bundleId?: string
  bundleName?: string
  description?: string
  effectiveFrom: string
  lines: RecipeLineInput[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InventoryError('VALIDATION_ERROR', `${field} is required`, 422)
  }
  return value.trim()
}

export function parseRecipeCommand(input: unknown): RecipeCommandInput {
  if (!isRecord(input)) throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)

  const bundleId = typeof input.bundleId === 'string' && input.bundleId.trim() ? input.bundleId.trim() : undefined
  const bundleName = typeof input.bundleName === 'string' && input.bundleName.trim() ? input.bundleName.trim() : undefined
  if (!bundleId && !bundleName) {
    throw new InventoryError('VALIDATION_ERROR', 'bundleId or bundleName is required', 422)
  }
  if (bundleName && bundleName.length > 150) {
    throw new InventoryError('VALIDATION_ERROR', 'bundleName is too long', 422)
  }

  const effectiveFrom = requiredText(input.effectiveFrom, 'effectiveFrom')
  if (validateDateOnly(effectiveFrom) !== true) {
    throw new InventoryError('VALIDATION_ERROR', 'effectiveFrom must be a valid YYYY-MM-DD date', 422)
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new InventoryError('VALIDATION_ERROR', 'At least one recipe line is required', 422)
  }

  const lines = input.lines.map((value) => {
    if (!isRecord(value)) throw new InventoryError('VALIDATION_ERROR', 'Invalid recipe line', 422)
    const productId = requiredText(value.productId, 'productId')
    const quantity = value.quantity
    if (validatePositiveInteger(quantity) !== true) {
      throw new InventoryError('VALIDATION_ERROR', 'quantity must be a positive integer', 422)
    }
    return { productId, quantity: quantity as number }
  })

  if (new Set(lines.map((line) => line.productId)).size !== lines.length) {
    throw new InventoryError('VALIDATION_ERROR', 'A recipe cannot contain the same product twice', 422)
  }

  return {
    bundleId,
    bundleName,
    description: typeof input.description === 'string' ? input.description.trim() || undefined : undefined,
    effectiveFrom,
    lines,
  }
}
