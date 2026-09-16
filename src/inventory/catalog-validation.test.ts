import { describe, expect, it } from 'vitest'

import {
  parseCreateCategoryInput,
  parseCreateProductInput,
  parseRequiredReason,
  parseUpdateCategoryInput,
  parseUpdateProductInput,
} from './catalog-validation'

describe('parseCreateProductInput', () => {
  it('accepts a valid product payload', () => {
    expect(parseCreateProductInput({
      category: 'category-1',
      minimumStock: 2,
      name: 'Arroz',
      tracksLotExpiration: true,
    })).toEqual({
      categoryId: 'category-1',
      minimumStock: 2,
      name: 'Arroz',
      tracksLotExpiration: true,
    })
  })
})

describe('parseUpdateProductInput', () => {
  it('requires at least one field', () => {
    expect(() => parseUpdateProductInput({})).toThrow('At least one field must be provided')
  })

  it('accepts partial updates', () => {
    expect(parseUpdateProductInput({ minimumStock: 5, name: 'Arroz premium' })).toEqual({
      categoryId: undefined,
      minimumStock: 5,
      name: 'Arroz premium',
      tracksLotExpiration: undefined,
    })
  })
})

describe('parseCreateCategoryInput', () => {
  it('accepts a valid category name', () => {
    expect(parseCreateCategoryInput({ name: 'Alimentos' })).toEqual({ name: 'Alimentos' })
  })
})

describe('parseUpdateCategoryInput', () => {
  it('accepts rename and activation changes', () => {
    expect(parseUpdateCategoryInput({ isActive: false, name: 'Alimentos secos' })).toEqual({
      isActive: false,
      name: 'Alimentos secos',
    })
  })
})

describe('parseRequiredReason', () => {
  it('requires a non-empty reason', () => {
    expect(parseRequiredReason('Error de carga')).toBe('Error de carga')
    expect(() => parseRequiredReason('   ')).toThrow('A reason is required')
  })
})
