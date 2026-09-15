import type { PayloadRequest } from 'payload'

import { getContribuyenteById } from '@/integrations/padron/san-benito-client'
import { formatContribuyenteNombre, type Contribuyente } from '@/lib/contribuyente-map'
import { getRoles } from '../access/roles'
import type { FamilyGroup, GroupMember, KinshipRelation, User } from '../payload-types'
import { GroupError } from './errors'
import { assertKinshipObservation, ensureKinshipCatalog, getKinshipById, getReferenteKinship } from './kinship-catalog'
import type { NormalizedMemberDraft } from './types'
import {
  assertMultiGroupReasons,
  buildMemberDrafts,
  parseAddGroupMemberInput,
  parseCreateGroupInput,
  parseDeactivateMemberInput,
  parseUpdateGroupInput,
} from './validation'

export type GroupRequest = PayloadRequest & {
  user?: User | null
}

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function relationId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') return value.id
  throw new GroupError('INTERNAL_ERROR', 'Relación inválida en datos de grupo.', 500)
}

async function auditGroupAction(
  req: GroupRequest,
  actor: User,
  data: {
    action: string
    after?: JsonValue
    before?: JsonValue
    context?: JsonValue
    reason?: string
    result: 'success' | 'replayed' | 'rejected'
    targetId: string
    targetType: string
  },
): Promise<void> {
  await req.payload.create({
    collection: 'audit-logs',
    data: {
      action: data.action,
      actor: actor.id,
      actorRoles: getRoles(actor),
      after: data.after,
      before: data.before,
      context: data.context,
      module: 'groups',
      reason: data.reason,
      result: data.result,
      targetId: data.targetId,
      targetType: data.targetType,
    },
    overrideAccess: true,
    req,
  })
}

async function assertContributorExists(contributorId: string): Promise<Contribuyente> {
  try {
    const { doc: contributor } = await getContribuyenteById(contributorId)
    if (!contributor?.id) {
      throw new GroupError('NOT_FOUND', 'El contribuyente no existe en el padrón.', 404)
    }
    return contributor
  } catch (error) {
    if (error instanceof GroupError) throw error
    throw new GroupError('NOT_FOUND', 'El contribuyente no existe en el padrón.', 404)
  }
}

async function loadActiveMembershipsByContributor(
  req: GroupRequest,
  contributorIds: string[],
  excludeGroupId?: string,
): Promise<Map<string, { contributorId: string; groupId: string; groupReferenteContributorId: string }[]>> {
  if (contributorIds.length === 0) return new Map()

  const memberships = await req.payload.find({
    collection: 'group-members',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
    where: {
      and: [
        { contributorId: { in: contributorIds } },
        { status: { equals: 'active' } },
      ],
    },
  })

  const groupIds = Array.from(
    new Set(
      memberships.docs
        .map((member) => relationId((member as GroupMember).group))
        .filter((groupId) => groupId !== excludeGroupId),
    ),
  )

  const groups = groupIds.length
    ? await req.payload.find({
        collection: 'family-groups',
        depth: 0,
        limit: groupIds.length,
        overrideAccess: true,
        req,
        where: {
          and: [
            { id: { in: groupIds } },
            { status: { equals: 'active' } },
          ],
        },
      })
    : { docs: [] as FamilyGroup[] }

  const activeGroupMap = new Map(groups.docs.map((group) => [group.id, group as FamilyGroup]))
  const result = new Map<string, { contributorId: string; groupId: string; groupReferenteContributorId: string }[]>()

  for (const member of memberships.docs as GroupMember[]) {
    const groupId = relationId(member.group)
    if (groupId === excludeGroupId) continue
    const group = activeGroupMap.get(groupId)
    if (!group) continue
    const bucket = result.get(member.contributorId) ?? []
    bucket.push({
      contributorId: member.contributorId,
      groupId,
      groupReferenteContributorId: group.referenteContributorId,
    })
    result.set(member.contributorId, bucket)
  }

  return result
}

async function validateMemberDrafts(
  req: GroupRequest,
  drafts: NormalizedMemberDraft[],
  excludeGroupId?: string,
): Promise<void> {
  const contributorIds = drafts.map((draft) => draft.contributorId)
  for (const contributorId of contributorIds) {
    await assertContributorExists(contributorId)
  }

  for (const draft of drafts) {
    const kinship = await getKinshipById(req, draft.kinshipId)
    assertKinshipObservation(kinship, draft.kinshipObservation)
  }

  const existing = await loadActiveMembershipsByContributor(req, contributorIds, excludeGroupId)
  assertMultiGroupReasons(drafts, existing)
}

async function createMembers(
  req: GroupRequest,
  groupId: string,
  drafts: NormalizedMemberDraft[],
): Promise<GroupMember[]> {
  const created: GroupMember[] = []
  const startedAt = todayIsoDate()

  for (const draft of drafts) {
    const member = await req.payload.create({
      collection: 'group-members',
      data: {
        contributorId: draft.contributorId,
        group: groupId,
        isReferent: draft.isReferent,
        kinship: draft.kinshipId,
        kinshipObservation: draft.kinshipObservation,
        multiGroupReason: draft.multiGroupReason,
        startedAt,
        status: 'active',
      },
      overrideAccess: true,
      req,
    })
    created.push(member as GroupMember)
  }

  return created
}

export async function listKinships(req: GroupRequest): Promise<KinshipRelation[]> {
  return ensureKinshipCatalog(req)
}

export type HydratedMember = {
  contributor?: Contribuyente | null
  contributorError?: string
  member: GroupMember
  kinship: KinshipRelation
}

export type HydratedGroup = {
  group: FamilyGroup
  members: HydratedMember[]
  referente?: Contribuyente | null
  referenteError?: string
}

async function hydrateContributor(contributorId: string): Promise<{ contributor?: Contribuyente | null; error?: string }> {
  try {
    const { doc } = await getContribuyenteById(contributorId)
    return { contributor: doc }
  } catch {
    return { contributor: null, error: 'No se pudo consultar el padrón para este contribuyente.' }
  }
}

export async function hydrateGroup(req: GroupRequest, group: FamilyGroup): Promise<HydratedGroup> {
  const catalog = await ensureKinshipCatalog(req)
  const kinshipMap = new Map(catalog.map((item) => [item.id, item]))

  const membersResult = await req.payload.find({
    collection: 'group-members',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
    sort: '-isReferent,startedAt',
    where: {
      group: { equals: group.id },
    },
  })

  const members: HydratedMember[] = []
  for (const member of membersResult.docs as GroupMember[]) {
    const kinshipId = relationId(member.kinship)
    const kinship = kinshipMap.get(kinshipId)
    if (!kinship) {
      throw new GroupError('INTERNAL_ERROR', 'Parentesco de integrante no encontrado.', 500)
    }
    const hydrated = await hydrateContributor(member.contributorId)
    members.push({
      member,
      kinship,
      contributor: hydrated.contributor,
      contributorError: hydrated.error,
    })
  }

  const referenteHydrated = await hydrateContributor(group.referenteContributorId)
  return {
    group,
    members,
    referente: referenteHydrated.contributor,
    referenteError: referenteHydrated.error,
  }
}

export async function listGroups(
  req: GroupRequest,
  options: { page: number; limit: number; search?: string; status?: 'active' | 'inactive' | 'all' },
): Promise<{ docs: HydratedGroup[]; totalDocs: number; page: number; totalPages: number; limit: number }> {
  const where =
    options.status && options.status !== 'all'
      ? { status: { equals: options.status } }
      : undefined

  const groupsResult = await req.payload.find({
    collection: 'family-groups',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
    sort: '-createdAt',
    ...(where ? { where } : {}),
  })

  let groups = groupsResult.docs as FamilyGroup[]
  const search = options.search?.trim().toLowerCase()

  if (search) {
    const filtered: FamilyGroup[] = []
    for (const group of groups) {
      const hydrated = await hydrateContributor(group.referenteContributorId)
      const name = formatContribuyenteNombre(hydrated.contributor?.nombre).toLowerCase()
      const dni = String(hydrated.contributor?.numero_documento ?? '').toLowerCase()
      if (name.includes(search) || dni.includes(search) || group.referenteContributorId.includes(search)) {
        filtered.push(group)
      }
    }
    groups = filtered
  }

  const totalDocs = groups.length
  const totalPages = Math.max(1, Math.ceil(totalDocs / options.limit))
  const page = Math.min(options.page, totalPages)
  const start = (page - 1) * options.limit
  const pageGroups = groups.slice(start, start + options.limit)
  const docs = await Promise.all(pageGroups.map((group) => hydrateGroup(req, group)))

  return { docs, totalDocs, page, totalPages, limit: options.limit }
}

export async function getGroupById(req: GroupRequest, groupId: string): Promise<HydratedGroup> {
  const group = await req.payload.findByID({
    collection: 'family-groups',
    depth: 0,
    id: groupId,
    overrideAccess: true,
    req,
  })

  if (!group) {
    throw new GroupError('NOT_FOUND', 'Grupo no encontrado.', 404)
  }

  return hydrateGroup(req, group as FamilyGroup)
}

export async function createGroup(req: GroupRequest, input: unknown): Promise<HydratedGroup> {
  if (!req.user) throw new GroupError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)

  const parsed = parseCreateGroupInput(input)
  const referenteKinship = await getReferenteKinship(req)
  const drafts = buildMemberDrafts(parsed, referenteKinship.id)
  await validateMemberDrafts(req, drafts)

  const startedAt = todayIsoDate()
  const group = await req.payload.create({
    collection: 'family-groups',
    data: {
      observations: parsed.observations,
      referenteContributorId: parsed.referenteContributorId,
      startedAt,
      status: 'active',
    },
    overrideAccess: true,
    req,
  })

  const members = await createMembers(req, group.id, drafts)

  await auditGroupAction(req, req.user, {
    action: 'groups.created',
    after: { group, members },
    result: 'success',
    targetId: group.id,
    targetType: 'family-group',
  })

  return getGroupById(req, group.id)
}

export async function updateGroup(req: GroupRequest, groupId: string, input: unknown): Promise<HydratedGroup> {
  if (!req.user) throw new GroupError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)

  const current = await getGroupById(req, groupId)
  const parsed = parseUpdateGroupInput(input)
  const data: Partial<FamilyGroup> = {}

  if (parsed.observations !== undefined) data.observations = parsed.observations

  if (parsed.referenteContributorId && parsed.referenteContributorId !== current.group.referenteContributorId) {
    await assertContributorExists(parsed.referenteContributorId)
    const activeMember = current.members.find(
      (item) => item.member.contributorId === parsed.referenteContributorId && item.member.status === 'active',
    )
    if (!activeMember) {
      throw new GroupError('VALIDATION_ERROR', 'El nuevo referente debe ser un integrante activo del grupo.', 422)
    }

    await req.payload.update({
      collection: 'group-members',
      data: { isReferent: false },
      id: current.members.find((item) => item.member.isReferent)?.member.id ?? '',
      overrideAccess: true,
      req,
    })

    await req.payload.update({
      collection: 'group-members',
      data: { isReferent: true },
      id: activeMember.member.id,
      overrideAccess: true,
      req,
    })

    data.referenteContributorId = parsed.referenteContributorId
  }

  if (parsed.status === 'inactive') {
    if (!parsed.endReason) {
      throw new GroupError('VALIDATION_ERROR', 'Debe indicar un motivo para dar de baja el grupo.', 422)
    }
    data.status = 'inactive'
    data.endedAt = todayIsoDate()
    data.endReason = parsed.endReason

    for (const item of current.members) {
      if (item.member.status !== 'active') continue
      await req.payload.update({
        collection: 'group-members',
        data: {
          endReason: parsed.endReason,
          endedAt: todayIsoDate(),
          status: 'inactive',
        },
        id: item.member.id,
        overrideAccess: true,
        req,
      })
    }
  }

  const updated = await req.payload.update({
    collection: 'family-groups',
    data,
    id: groupId,
    overrideAccess: true,
    req,
  })

  await auditGroupAction(req, req.user, {
    action: 'groups.updated',
    after: updated as unknown as JsonValue,
    before: current.group as unknown as JsonValue,
    reason: parsed.endReason,
    result: 'success',
    targetId: groupId,
    targetType: 'family-group',
  })

  return getGroupById(req, groupId)
}

export async function addGroupMember(req: GroupRequest, groupId: string, input: unknown): Promise<HydratedGroup> {
  if (!req.user) throw new GroupError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)

  const current = await getGroupById(req, groupId)
  if (current.group.status !== 'active') {
    throw new GroupError('CONFLICT', 'No se pueden agregar integrantes a un grupo inactivo.', 409)
  }

  const parsed = parseAddGroupMemberInput(input)
  if (parsed.contributorId === current.group.referenteContributorId) {
    throw new GroupError('VALIDATION_ERROR', 'El referente ya forma parte del grupo.', 422)
  }

  const existing = current.members.find(
    (item) => item.member.contributorId === parsed.contributorId && item.member.status === 'active',
  )
  if (existing) {
    throw new GroupError('VALIDATION_ERROR', 'El integrante ya pertenece al grupo.', 422)
  }

  const draft: NormalizedMemberDraft = {
    contributorId: parsed.contributorId,
    isReferent: false,
    kinshipId: parsed.kinshipId,
    kinshipObservation: parsed.kinshipObservation,
    multiGroupReason: parsed.multiGroupReason,
  }

  await validateMemberDrafts(req, [draft], groupId)
  await createMembers(req, groupId, [draft])

  await auditGroupAction(req, req.user, {
    action: 'groups.member.added',
    after: draft,
    result: 'success',
    targetId: groupId,
    targetType: 'family-group',
  })

  return getGroupById(req, groupId)
}

export async function deactivateGroupMember(
  req: GroupRequest,
  groupId: string,
  memberId: string,
  input: unknown,
): Promise<HydratedGroup> {
  if (!req.user) throw new GroupError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)

  const current = await getGroupById(req, groupId)
  const memberItem = current.members.find((item) => item.member.id === memberId)
  if (!memberItem) {
    throw new GroupError('NOT_FOUND', 'Integrante no encontrado.', 404)
  }
  if (memberItem.member.status !== 'active') {
    throw new GroupError('CONFLICT', 'La membresía ya está inactiva.', 409)
  }

  const activeMembers = current.members.filter((item) => item.member.status === 'active')
  if (activeMembers.length <= 1) {
    throw new GroupError('VALIDATION_ERROR', 'El grupo debe conservar al menos un integrante activo.', 422)
  }

  if (memberItem.member.isReferent) {
    throw new GroupError(
      'VALIDATION_ERROR',
      'No se puede dar de baja al referente. Cambiá el referente antes de continuar.',
      422,
    )
  }

  const parsed = parseDeactivateMemberInput(input)
  const updatedMember = await req.payload.update({
    collection: 'group-members',
    data: {
      endReason: parsed.endReason,
      endedAt: todayIsoDate(),
      status: 'inactive',
    },
    id: memberId,
    overrideAccess: true,
    req,
  })

  await auditGroupAction(req, req.user, {
    action: 'groups.member.deactivated',
    after: updatedMember as unknown as JsonValue,
    before: memberItem.member as unknown as JsonValue,
    reason: parsed.endReason,
    result: 'success',
    targetId: memberId,
    targetType: 'group-member',
  })

  return getGroupById(req, groupId)
}

export async function checkContributorMemberships(
  req: GroupRequest,
  contributorId: string,
  excludeGroupId?: string,
): Promise<{ contributorId: string; groupId: string; groupReferenteContributorId: string }[]> {
  await assertContributorExists(contributorId)
  const map = await loadActiveMembershipsByContributor(req, [contributorId], excludeGroupId)
  return map.get(contributorId) ?? []
}
