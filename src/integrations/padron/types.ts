export type PadronStatus = 'solicitada' | 'confirmada' | 'rechazada' | 'incierta'

export type PadronTerminalStatus = Exclude<PadronStatus, 'solicitada'>

export type PadronOperation = 'search' | 'create' | 'update' | 'deactivate'

export type PadronErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INTEGRATION_REJECTED'
  | 'INTEGRATION_UNCERTAIN'

export interface PadronError {
  code: PadronErrorCode
  message: string
}

export interface PadronResult<T> {
  operationId: string
  operation: PadronOperation
  status: PadronTerminalStatus
  history: PadronStatus[]
  data?: T
  error?: PadronError
}

export interface PadronContributor {
  id: string
  dni: string
  cuit?: string
  firstName: string
  lastName: string
  birthDate?: string
  phone?: string
  address: string
  neighborhood: string
  isActive: boolean
}

export interface SearchContributorsInput {
  id?: string
  dni?: string
  cuit?: string
  name?: string
  isActive?: boolean
}

export interface CreateContributorInput {
  dni: string
  cuit?: string
  firstName: string
  lastName: string
  birthDate?: string
  phone?: string
  address: string
  neighborhood: string
  isActive?: boolean
}

export type UpdateContributorInput = Partial<CreateContributorInput>

export interface IdempotencyOptions {
  idempotencyKey: string
}

export interface PadronAdapter {
  search(input: SearchContributorsInput): Promise<PadronResult<PadronContributor[]>>
  create(
    input: CreateContributorInput,
    options: IdempotencyOptions,
  ): Promise<PadronResult<PadronContributor>>
  update(
    id: string,
    input: UpdateContributorInput,
    options: IdempotencyOptions,
  ): Promise<PadronResult<PadronContributor>>
  deactivate(
    id: string,
    options: IdempotencyOptions,
  ): Promise<PadronResult<PadronContributor>>
}

export interface MockPadronAdapterOptions {
  contributors?: readonly PadronContributor[]
  readStatus?: PadronTerminalStatus
  writeStatus?: PadronTerminalStatus
}
