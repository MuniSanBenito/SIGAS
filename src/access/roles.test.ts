import { describe, expect, it } from 'vitest'

import { canAccessModule, deliveryOperator, getRoles, hasAnyRole, hasRole, inventoryOperator } from './roles'

describe('role permissions', () => {
  it('recognizes a role assigned to the user', () => {
    expect(hasRole({ roles: ['stock'] }, 'stock')).toBe(true)
    expect(hasRole({ roles: ['stock'] }, 'administracion')).toBe(false)
  })

  it('combines permissions from multiple roles', () => {
    const user = { roles: ['stock', 'administracion'] }

    expect(hasAnyRole(user, ['stock'])).toBe(true)
    expect(hasAnyRole(user, ['administracion'])).toBe(true)
    expect(canAccessModule(user, 'inventory')).toBe(true)
    expect(canAccessModule(user, 'groups')).toBe(true)
    expect(canAccessModule(user, 'deliveries')).toBe(true)
  })

  it('gives the administrator access to every current module', () => {
    const user = { roles: ['admin'] }

    expect(canAccessModule(user, 'inventory')).toBe(true)
    expect(canAccessModule(user, 'groups')).toBe(true)
    expect(canAccessModule(user, 'deliveries')).toBe(true)
  })

  it('does not grant module access to users without the corresponding role', () => {
    expect(canAccessModule({ roles: ['stock'] }, 'groups')).toBe(false)
    expect(canAccessModule({ roles: ['administracion'] }, 'groups')).toBe(true)
    expect(canAccessModule({ roles: ['administracion'] }, 'inventory')).toBe(false)
    expect(canAccessModule({ roles: ['administracion'] }, 'deliveries')).toBe(true)
    expect(canAccessModule({ roles: ['stock'] }, 'deliveries')).toBe(false)
    expect(canAccessModule({ roles: [] }, 'inventory')).toBe(false)
  })

  it('allows delivery operators through the delivery access guard', () => {
    expect(deliveryOperator({ req: { user: { roles: ['administracion'] } } })).toBe(true)
    expect(deliveryOperator({ req: { user: { roles: ['admin'] } } })).toBe(true)
    expect(deliveryOperator({ req: { user: { roles: ['stock'] } } })).toBe(false)
    expect(deliveryOperator({ req: { user: null } })).toBe(false)
  })

  it('allows only inventory operators through the inventory access guard', () => {
    expect(inventoryOperator({ req: { user: { roles: ['stock'] } } })).toBe(true)
    expect(inventoryOperator({ req: { user: { roles: ['admin'] } } })).toBe(true)
    expect(inventoryOperator({ req: { user: { roles: ['administracion'] } } })).toBe(false)
    expect(inventoryOperator({ req: { user: null } })).toBe(false)
  })

  it('ignores missing and unknown roles', () => {
    expect(getRoles({})).toEqual([])
    expect(getRoles({ roles: ['future-role', 'stock'] })).toEqual(['stock'])
    expect(hasRole({ roles: 'stock' }, 'stock')).toBe(false)
  })
})
