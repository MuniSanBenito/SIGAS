import { describe, expect, it } from 'vitest'

import { normalizeDni } from './normalizeDni'

describe('normalizeDni', () => {
  it.each([
    ['12.345.678', '12345678'],
    ['12 345-678', '12345678'],
    ['00123456', '00123456'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeDni(input)).toBe(expected)
  })

  it.each(['', '12/345/678', '12A345678'])('rejects invalid DNI %s', (input) => {
    expect(() => normalizeDni(input)).toThrow('DNI must contain only digits')
  })
})
