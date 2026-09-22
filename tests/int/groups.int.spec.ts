import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { FamilyGroups } from '@/collections/FamilyGroups'
import config from '@/payload.config'
import {
  addGroupMember,
  createGroup,
  deactivateGroupMember,
  getGroupById,
  type GroupRequest,
} from '@/groups/group-service'
import type { KinshipRelation, User } from '@/payload-types'

vi.mock('@/integrations/padron/san-benito-client', () => ({
  getContribuyenteById: vi.fn(async (id: string) => ({
    doc: {
      id,
      nombre: id === 'contrib-1' ? 'Ana Referente' : 'Bruno Hijo',
      numero_documento: id === 'contrib-1' ? '30111222' : '30999888',
      domicilio: 'Calle 1',
      barrio: 'Centro',
    },
  })),
}))

describe('family groups service', () => {
  let payload: Payload
  let actor: User
  let groupId: string
  let secondMemberId: string
  let hijoKinshipId: string

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    actor = (await payload.create({
      collection: 'users',
      data: {
        password: 'test',
        roles: ['administracion'],
        username: `992${Date.now().toString().slice(-6)}`,
      },
      overrideAccess: true,
    })) as User
  })

  afterAll(async () => {
    if (!payload) return
    if (groupId) {
      await payload.delete({
        collection: 'group-members',
        where: { group: { equals: groupId } },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'family-groups', id: groupId, overrideAccess: true })
    }
    await payload.delete({ collection: 'users', id: actor.id, overrideAccess: true })
  })

  it('creates a single-member group without copying contributors into Mongo', async () => {
    const req = { payload, user: actor } as unknown as GroupRequest
    const created = await createGroup(req, {
      referenteContributorId: 'contrib-1',
      observations: 'Grupo de prueba',
    })

    groupId = created.group.id
    expect(created.group.referenteContributorId).toBe('contrib-1')
    expect(created.members).toHaveLength(1)
    expect(created.members[0]?.member.isReferent).toBe(true)

    const kinships = await payload.find({
      collection: 'kinship-relations',
      depth: 0,
      limit: 10,
      overrideAccess: true,
      sort: 'sortOrder',
    })
    const hijo = kinships.docs.find((item) => (item as KinshipRelation).code === 'hijo')
    expect(hijo).toBeDefined()
    hijoKinshipId = hijo!.id
  })

  it('requires a reason when adding a member with active memberships elsewhere', async () => {
    const req = { payload, user: actor } as unknown as GroupRequest

    await expect(
      createGroup(req, {
        referenteContributorId: 'contrib-2',
        members: [{ contributorId: 'contrib-1', kinshipId: hijoKinshipId }],
      }),
    ).rejects.toThrow('motivo')
  })

  it('adds a second member when the multiple-membership reason is provided', async () => {
    const req = { payload, user: actor } as unknown as GroupRequest
    const withMember = await addGroupMember(req, groupId, {
      contributorId: 'contrib-2',
      kinshipId: hijoKinshipId,
      multiGroupReason: 'Convive parcialmente',
    })

    expect(withMember.members.filter((item) => item.member.status === 'active')).toHaveLength(2)
    secondMemberId = withMember.members.find((item) => item.member.contributorId === 'contrib-2')?.member.id ?? ''
    expect(secondMemberId).toBeTruthy()
  })

  it('prevents stock users from creating groups through collection access', () => {
    expect(FamilyGroups.access?.create?.({ req: { user: { roles: ['stock'] } } } as never)).toBe(false)
    expect(FamilyGroups.access?.create?.({ req: { user: { roles: ['administracion'] } } } as never)).toBe(true)
  })

  it('deactivates a non-referent member while keeping the group active', async () => {
    const req = { payload, user: actor } as unknown as GroupRequest
    const result = await deactivateGroupMember(req, groupId, secondMemberId, {
      endReason: 'Se mudó',
    })

    expect(result.members.find((item) => item.member.id === secondMemberId)?.member.status).toBe('inactive')
    expect(result.members.filter((item) => item.member.status === 'active')).toHaveLength(1)
    const reloaded = await getGroupById(req, groupId)
    expect(reloaded.group.status).toBe('active')
  })
})
