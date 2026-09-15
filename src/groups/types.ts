export type GroupStatus = 'active' | 'inactive'
export type MemberStatus = 'active' | 'inactive'

export type CreateGroupMemberInput = {
  contributorId: string
  kinshipId: string
  kinshipObservation?: string
  multiGroupReason?: string
}

export type CreateGroupInput = {
  referenteContributorId: string
  observations?: string
  members?: CreateGroupMemberInput[]
}

export type AddGroupMemberInput = CreateGroupMemberInput

export type UpdateGroupInput = {
  observations?: string
  referenteContributorId?: string
  status?: GroupStatus
  endReason?: string
}

export type DeactivateMemberInput = {
  endReason: string
}

export type ExistingActiveMembership = {
  contributorId: string
  groupId: string
  groupReferenteContributorId: string
}

export type NormalizedMemberDraft = {
  contributorId: string
  kinshipId: string
  isReferent: boolean
  kinshipObservation?: string
  multiGroupReason?: string
}
