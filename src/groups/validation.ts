import { GroupError } from './errors'
import type { AddGroupMemberInput, CreateGroupInput, CreateGroupMemberInput, NormalizedMemberDraft } from './types'

export { GroupError }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GroupError('VALIDATION_ERROR', `${field} es obligatorio.`, 422)
  }
  return value.trim()
}

function optionalString(value: unknown, field: string, maxLength = 500): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new GroupError('VALIDATION_ERROR', `${field} debe ser texto.`, 422)
  }
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length > maxLength) {
    throw new GroupError('VALIDATION_ERROR', `${field} es demasiado largo.`, 422)
  }
  return trimmed
}

function parseMemberInput(value: unknown): CreateGroupMemberInput {
  if (!isRecord(value)) {
    throw new GroupError('VALIDATION_ERROR', 'Cada integrante debe ser un objeto.', 422)
  }

  return {
    contributorId: requiredString(value.contributorId, 'contributorId'),
    kinshipId: requiredString(value.kinshipId, 'kinshipId'),
    kinshipObservation: optionalString(value.kinshipObservation, 'kinshipObservation'),
    multiGroupReason: optionalString(value.multiGroupReason, 'multiGroupReason'),
  }
}

export function parseCreateGroupInput(input: unknown): CreateGroupInput {
  if (!isRecord(input)) {
    throw new GroupError('VALIDATION_ERROR', 'El cuerpo de la solicitud debe ser un objeto.', 422)
  }

  const members = input.members === undefined
    ? undefined
    : Array.isArray(input.members)
      ? input.members.map(parseMemberInput)
      : (() => {
          throw new GroupError('VALIDATION_ERROR', 'members debe ser un arreglo.', 422)
        })()

  return {
    referenteContributorId: requiredString(input.referenteContributorId, 'referenteContributorId'),
    observations: optionalString(input.observations, 'observations', 2000),
    members,
  }
}

export function parseAddGroupMemberInput(input: unknown): AddGroupMemberInput {
  return parseMemberInput(input)
}

export function parseUpdateGroupInput(input: unknown): {
  observations?: string
  referenteContributorId?: string
  status?: 'active' | 'inactive'
  endReason?: string
} {
  if (!isRecord(input)) {
    throw new GroupError('VALIDATION_ERROR', 'El cuerpo de la solicitud debe ser un objeto.', 422)
  }

  const status = input.status
  if (status !== undefined && status !== 'active' && status !== 'inactive') {
    throw new GroupError('VALIDATION_ERROR', 'status debe ser active o inactive.', 422)
  }

  return {
    observations: optionalString(input.observations, 'observations', 2000),
    referenteContributorId: optionalString(input.referenteContributorId, 'referenteContributorId'),
    status,
    endReason: optionalString(input.endReason, 'endReason'),
  }
}

export function parseDeactivateMemberInput(input: unknown): { endReason: string } {
  if (!isRecord(input)) {
    throw new GroupError('VALIDATION_ERROR', 'El cuerpo de la solicitud debe ser un objeto.', 422)
  }

  return {
    endReason: requiredString(input.endReason, 'endReason'),
  }
}

export function buildMemberDrafts(
  input: CreateGroupInput,
  referenteKinshipId: string,
): NormalizedMemberDraft[] {
  const referenteId = input.referenteContributorId
  const drafts: NormalizedMemberDraft[] = [
    {
      contributorId: referenteId,
      kinshipId: referenteKinshipId,
      isReferent: true,
    },
  ]

  for (const member of input.members ?? []) {
    if (member.contributorId === referenteId) {
      throw new GroupError('VALIDATION_ERROR', 'El referente no debe repetirse en la lista de integrantes.', 422)
    }
    drafts.push({
      contributorId: member.contributorId,
      kinshipId: member.kinshipId,
      isReferent: false,
      kinshipObservation: member.kinshipObservation,
      multiGroupReason: member.multiGroupReason,
    })
  }

  assertMemberInvariants(drafts)
  return drafts
}

export function assertMemberInvariants(members: NormalizedMemberDraft[]): void {
  if (members.length === 0) {
    throw new GroupError('VALIDATION_ERROR', 'El grupo debe tener al menos un integrante.', 422)
  }

  const referents = members.filter((member) => member.isReferent)
  if (referents.length !== 1) {
    throw new GroupError('VALIDATION_ERROR', 'El grupo debe tener exactamente un referente.', 422)
  }

  const referent = referents[0]
  if (!members.some((member) => member.contributorId === referent.contributorId && member.isReferent)) {
    throw new GroupError('VALIDATION_ERROR', 'El referente debe ser integrante del grupo.', 422)
  }

  const seen = new Set<string>()
  for (const member of members) {
    if (seen.has(member.contributorId)) {
      throw new GroupError('VALIDATION_ERROR', 'Un integrante no puede repetirse en el mismo grupo.', 422)
    }
    seen.add(member.contributorId)
  }
}

export function assertMultiGroupReasons(
  members: NormalizedMemberDraft[],
  existingMemberships: Map<string, ExistingActiveMembership[]>,
): void {
  for (const member of members) {
    const conflicts = existingMemberships.get(member.contributorId) ?? []
    if (conflicts.length === 0) continue
    if (!member.multiGroupReason?.trim()) {
      throw new GroupError(
        'VALIDATION_ERROR',
        'Un integrante ya pertenece a otro grupo activo. Debe indicar un motivo para continuar.',
        422,
        { contributorId: member.contributorId, existingGroups: conflicts },
      )
    }
  }
}

export type ExistingActiveMembership = {
  contributorId: string
  groupId: string
  groupReferenteContributorId: string
}
