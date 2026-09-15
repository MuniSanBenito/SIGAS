import type { Contribuyente } from '@/lib/contribuyente-map'

export type KinshipOption = {
  id: string
  label: string
  code: string
  requiresObservation: boolean
}

export type GroupMemberView = {
  member: {
    id: string
    contributorId: string
    isReferent: boolean
    status: 'active' | 'inactive'
    kinshipObservation?: string | null
    multiGroupReason?: string | null
    endReason?: string | null
  }
  kinship: KinshipOption
  contributor?: Contribuyente | null
  contributorError?: string
}

export type FamilyGroupView = {
  group: {
    id: string
    status: 'active' | 'inactive'
    referenteContributorId: string
    observations?: string | null
    startedAt: string
    endedAt?: string | null
    endReason?: string | null
  }
  members: GroupMemberView[]
  referente?: Contribuyente | null
  referenteError?: string
}

export type ExistingMembership = {
  contributorId: string
  groupId: string
  groupReferenteContributorId: string
}

export type DraftMember = {
  contributor: Contribuyente
  kinshipId: string
  kinshipObservation: string
  multiGroupReason: string
  existingMemberships: ExistingMembership[]
}
