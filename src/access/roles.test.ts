import { describe, expect, it } from 'vitest'

import { canAccessModule, getRoles, hasAnyRole, hasRole } from './roles'

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
  })

  it('gives the administrator access to every current module', () => {
    const user = { roles: ['admin'] }

    expect(canAccessModule(user, 'inventory')).toBe(true)
    expect(canAccessModule(user, 'groups')).toBe(true)
  })

  it('does not grant module access to users without the corresponding role', () => {
    expect(canAccessModule({ roles: ['stock'] }, 'groups')).toBe(false)
    expect(canAccessModule({ roles: ['administracion'] }, 'inventory')).toBe(false)
    expect(canAccessModule({ roles: [] }, 'inventory')).toBe(false)
  })

  it('ignores missing and unknown roles', () => {
    expect(getRoles({})).toEqual([])
    expect(getRoles({ roles: ['future-role', 'stock'] })).toEqual(['stock'])
    expect(hasRole({ roles: 'stock' }, 'stock')).toBe(false)
  })
})
