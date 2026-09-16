import { InventoryError } from './errors'
import { validateNonNegativeInteger, validateRequiredText } from './field-validation'

export type CreateProductInput = {
  categoryId: string
  minimumStock: number
  name: string
  tracksLotExpiration: boolean
}

export type UpdateProductInput = {
  categoryId?: string
  minimumStock?: number
  name?: string
  tracksLotExpiration?: boolean
}

export type CreateCategoryInput = {
  name: string
}

export type UpdateCategoryInput = {
  isActive?: boolean
  name?: string
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

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !value.trim()) {
    throw new InventoryError('VALIDATION_ERROR', `${field} must be a non-empty string`, 422)
  }
  if (value.trim().length > 150) {
    throw new InventoryError('VALIDATION_ERROR', `${field} is too long`, 422)
  }
  return value.trim()
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') {
    throw new InventoryError('VALIDATION_ERROR', `${field} must be a boolean`, 422)
  }
  return value
}

function optionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (validateNonNegativeInteger(value) !== true) {
    throw new InventoryError('VALIDATION_ERROR', `${field} must be a non-negative integer`, 422)
  }
  return value as number
}

export function parseCreateProductInput(input: unknown): CreateProductInput {
  if (!isRecord(input)) throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)

  const name = requiredText(input.name, 'name')
  if (name.length > 150) throw new InventoryError('VALIDATION_ERROR', 'name is too long', 422)
  const categoryId = requiredText(input.category ?? input.categoryId, 'category')
  const minimumStock = optionalNonNegativeInteger(input.minimumStock, 'minimumStock') ?? 0
  const tracksLotExpiration = optionalBoolean(input.tracksLotExpiration, 'tracksLotExpiration') ?? false

  return { categoryId, minimumStock, name, tracksLotExpiration }
}

export function parseUpdateProductInput(input: unknown): UpdateProductInput {
  if (!isRecord(input)) throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)

  const name = optionalText(input.name, 'name')
  const categoryId = optionalText(input.category ?? input.categoryId, 'category')
  const minimumStock = optionalNonNegativeInteger(input.minimumStock, 'minimumStock')
  const tracksLotExpiration = optionalBoolean(input.tracksLotExpiration, 'tracksLotExpiration')

  if (name === undefined && categoryId === undefined && minimumStock === undefined && tracksLotExpiration === undefined) {
    throw new InventoryError('VALIDATION_ERROR', 'At least one field must be provided', 422)
  }

  return { categoryId, minimumStock, name, tracksLotExpiration }
}

export function parseCreateCategoryInput(input: unknown): CreateCategoryInput {
  if (!isRecord(input)) throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)

  const name = requiredText(input.name, 'name')
  if (validateRequiredText(name) !== true || name.length > 150) {
    throw new InventoryError('VALIDATION_ERROR', 'name is invalid or too long', 422)
  }

  return { name }
}

export function parseUpdateCategoryInput(input: unknown): UpdateCategoryInput {
  if (!isRecord(input)) throw new InventoryError('VALIDATION_ERROR', 'Request body must be an object', 422)

  const name = optionalText(input.name, 'name')
  const isActive = optionalBoolean(input.isActive, 'isActive')

  if (name === undefined && isActive === undefined) {
    throw new InventoryError('VALIDATION_ERROR', 'At least one field must be provided', 422)
  }

  return { isActive, name }
}

export function parseRequiredReason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InventoryError('VALIDATION_ERROR', 'A reason is required', 422)
  }
  if (value.trim().length > 500) {
    throw new InventoryError('VALIDATION_ERROR', 'The reason is too long', 422)
  }
  return value.trim()
}
