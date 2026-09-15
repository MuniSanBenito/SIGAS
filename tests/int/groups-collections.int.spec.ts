import { describe, expect, it } from 'vitest'

import { FamilyGroups } from '@/collections/FamilyGroups'
import { GroupMembers } from '@/collections/GroupMembers'
import { KinshipRelations } from '@/collections/KinshipRelations'

const accessArgs = (roles: string[]) => ({ req: { user: { roles } } })

const collections = [KinshipRelations, FamilyGroups, GroupMembers]

describe('group collection configuration', () => {
  it('registers the planned collection slugs', () => {
    expect(collections.map(({ slug }) => slug)).toEqual([
      'kinship-relations',
      'family-groups',
      'group-members',
    ])
  })

  it('allows admin and administracion to manage groups', () => {
    for (const collection of collections) {
      expect(collection.access?.read?.(accessArgs(['admin']) as never)).toBe(true)
      expect(collection.access?.read?.(accessArgs(['administracion']) as never)).toBe(true)
      expect(collection.access?.read?.(accessArgs(['stock']) as never)).toBe(false)
      expect(collection.access?.create?.(accessArgs(['administracion']) as never)).toBe(true)
      expect(collection.access?.create?.(accessArgs(['stock']) as never)).toBe(false)
      expect(collection.access?.delete?.(accessArgs(['admin']) as never)).toBe(false)
    }
  })
})
