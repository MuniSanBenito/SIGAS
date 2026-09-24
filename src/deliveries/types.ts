export type DeliveryBundleSelection = {
  bundleVersionId: string
  quantity: number
  modificationNote?: string
}

export type DeliveryRealLine = {
  productId: string
  lotId?: string
  quantity: number
  bundleVersionId?: string
  observation?: string
}

export const assistanceKinds = [
  'atmospheric',
  'materials',
  'money',
  'funeral',
  'medication',
  'orthopedic',
] as const

export type AssistanceKind = (typeof assistanceKinds)[number]

export type DeliveryAssistanceInput = {
  kind: AssistanceKind
  description: string
  quantity?: number
  amountPesos?: number
}

export type ConfirmDeliveryInput = {
  groupId: string
  receiverContributorId: string
  receiverIsThirdParty: boolean
  receiverAuthorizationReason?: string
  deliveryDate: string
  observations?: string
  recipeDiffReason?: string
  operationKey?: string
  reportId?: string
  bundles: DeliveryBundleSelection[]
  lines: DeliveryRealLine[]
  assistances: DeliveryAssistanceInput[]
}

export type ProposalBundleInput = {
  bundleVersionId: string
  quantity: number
}

export type ProposalLooseInput = {
  productId: string
  quantity: number
}

export type ProposalInput = {
  bundles: ProposalBundleInput[]
  looseProducts: ProposalLooseInput[]
}

export type ProposedLine = {
  productId: string
  quantity: number
  bundleVersionId?: string
}
