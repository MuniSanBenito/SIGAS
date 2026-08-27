import { normalizeDni } from '../../normalizeDni'
import type {
  CreateContributorInput,
  IdempotencyOptions,
  MockPadronAdapterOptions,
  PadronAdapter,
  PadronContributor,
  PadronError,
  PadronOperation,
  PadronResult,
  PadronTerminalStatus,
  SearchContributorsInput,
  UpdateContributorInput,
} from './types'

const cloneContributor = (contributor: PadronContributor): PadronContributor => ({
  ...contributor,
})

const cloneResult = <T>(result: PadronResult<T>): PadronResult<T> => ({
  ...result,
  history: [...result.history],
  data: Array.isArray(result.data)
    ? result.data.map((item) => ({ ...item })) as T
    : result.data && typeof result.data === 'object'
      ? { ...result.data } as T
      : result.data,
  error: result.error ? { ...result.error } : undefined,
})

const normalizeCuit = (value: string | undefined): string | undefined => {
  const normalized = value?.trim()
  return normalized || undefined
}

const normalizeContributor = (contributor: PadronContributor): PadronContributor => ({
  ...contributor,
  dni: normalizeDni(contributor.dni),
  cuit: normalizeCuit(contributor.cuit),
  isActive: contributor.isActive ?? true,
})

const errorForStatus = (status: PadronTerminalStatus): PadronError => ({
  code: status === 'incierta' ? 'INTEGRATION_UNCERTAIN' : 'INTEGRATION_REJECTED',
  message:
    status === 'incierta'
      ? 'The mock padrón returned an uncertain result'
      : 'The mock padrón rejected the operation',
})

export const createMockPadronAdapter = (
  options: MockPadronAdapterOptions = {},
): PadronAdapter => {
  const contributors = new Map<string, PadronContributor>()
  const idempotentResults = new Map<string, PadronResult<unknown>>()
  const readStatus = options.readStatus ?? 'confirmada'
  const writeStatus = options.writeStatus ?? 'confirmada'
  let operationSequence = 0
  let contributorSequence = 0

  for (const contributor of options.contributors ?? []) {
    const normalized = normalizeContributor(contributor)
    contributors.set(normalized.id, normalized)
  }

  const createResult = <T>(
    operation: PadronOperation,
    status: PadronTerminalStatus,
    data?: T,
    error?: PadronError,
  ): PadronResult<T> => ({
    operationId: `mock-padron-${++operationSequence}`,
    operation,
    status,
    history: ['solicitada', status],
    data,
    error,
  })

  const getCachedResult = <T>(
    operation: PadronOperation,
    idempotencyKey: string,
  ): PadronResult<T> | undefined => {
    const result = idempotentResults.get(`${operation}:${idempotencyKey}`)
    return result ? cloneResult(result as PadronResult<T>) : undefined
  }

  const cacheResult = <T>(
    operation: PadronOperation,
    idempotencyKey: string,
    result: PadronResult<T>,
  ): PadronResult<T> => {
    idempotentResults.set(`${operation}:${idempotencyKey}`, result as PadronResult<unknown>)
    return cloneResult(result)
  }

  const rejected = <T>(
    operation: PadronOperation,
    code: PadronError['code'],
    message: string,
    data?: T,
  ): PadronResult<T> =>
    createResult(operation, 'rechazada', data, {
      code,
      message,
    })

  const validateSearch = (input: SearchContributorsInput): PadronResult<PadronContributor[]> | null => {
    const values = Object.values(input ?? {})
    if (!values.some((value) => value !== undefined && value !== '')) {
      return rejected('search', 'INVALID_INPUT', 'At least one search filter is required', [])
    }

    if (input.dni !== undefined) {
      try {
        normalizeDni(input.dni)
      } catch {
        return rejected('search', 'INVALID_INPUT', 'DNI must contain only digits', [])
      }
    }

    if (input.id !== undefined && !input.id.trim()) {
      return rejected('search', 'INVALID_INPUT', 'ID cannot be empty', [])
    }

    if (input.cuit !== undefined && !normalizeCuit(input.cuit)) {
      return rejected('search', 'INVALID_INPUT', 'CUIT cannot be empty', [])
    }

    if (input.name !== undefined && !input.name.trim()) {
      return rejected('search', 'INVALID_INPUT', 'Name cannot be empty', [])
    }

    return null
  }

  const search = async (input: SearchContributorsInput): Promise<PadronResult<PadronContributor[]>> => {
    const invalid = validateSearch(input)
    if (invalid) return invalid

    if (readStatus !== 'confirmada') {
      return createResult('search', readStatus, [], errorForStatus(readStatus))
    }

    const dni = input.dni ? normalizeDni(input.dni) : undefined
    const cuit = normalizeCuit(input.cuit)
    const name = input.name?.trim().toLowerCase()
    const results = [...contributors.values()].filter((contributor) => {
      const fullName = `${contributor.firstName} ${contributor.lastName}`.toLowerCase()

      return (
        (input.id === undefined || contributor.id === input.id.trim()) &&
        (dni === undefined || contributor.dni === dni) &&
        (cuit === undefined || contributor.cuit === cuit) &&
        (name === undefined || fullName.includes(name)) &&
        (input.isActive === undefined || contributor.isActive === input.isActive)
      )
    })

    if (results.length === 0) {
      return rejected('search', 'NOT_FOUND', 'Contributor not found', [])
    }

    return createResult('search', 'confirmada', results.map(cloneContributor))
  }

  const create = async (
    input: CreateContributorInput,
    options: IdempotencyOptions,
  ): Promise<PadronResult<PadronContributor>> => {
    const idempotencyKey = options?.idempotencyKey?.trim()
    if (!idempotencyKey) {
      return rejected('create', 'MISSING_IDEMPOTENCY_KEY', 'Idempotency key is required')
    }

    const cached = getCachedResult<PadronContributor>('create', idempotencyKey)
    if (cached) return cached

    let dni: string
    try {
      dni = normalizeDni(input.dni)
    } catch {
      return cacheResult(
        'create',
        idempotencyKey,
        rejected('create', 'INVALID_INPUT', 'DNI must contain only digits'),
      )
    }

    if ([input.firstName, input.lastName, input.address, input.neighborhood].some((value) => !value.trim())) {
      return cacheResult(
        'create',
        idempotencyKey,
        rejected('create', 'INVALID_INPUT', 'Contributor name, address, and neighborhood are required'),
      )
    }

    const cuit = normalizeCuit(input.cuit)
    const duplicate = [...contributors.values()].some(
      (contributor) => contributor.dni === dni || (cuit !== undefined && contributor.cuit === cuit),
    )
    if (duplicate) {
      return cacheResult(
        'create',
        idempotencyKey,
        rejected('create', 'DUPLICATE', 'DNI or CUIT already exists'),
      )
    }

    if (writeStatus !== 'confirmada') {
      return cacheResult(
        'create',
        idempotencyKey,
        createResult<PadronContributor>('create', writeStatus, undefined, errorForStatus(writeStatus)),
      )
    }

    const contributor: PadronContributor = {
      id: `mock-contributor-${++contributorSequence}`,
      dni,
      cuit,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      address: input.address.trim(),
      neighborhood: input.neighborhood.trim(),
      isActive: input.isActive ?? true,
    }
    contributors.set(contributor.id, contributor)

    return cacheResult('create', idempotencyKey, createResult('create', 'confirmada', cloneContributor(contributor)))
  }

  const update = async (
    id: string,
    input: UpdateContributorInput,
    options: IdempotencyOptions,
  ): Promise<PadronResult<PadronContributor>> => {
    const idempotencyKey = options?.idempotencyKey?.trim()
    if (!idempotencyKey) {
      return rejected('update', 'MISSING_IDEMPOTENCY_KEY', 'Idempotency key is required')
    }

    const cached = getCachedResult<PadronContributor>('update', idempotencyKey)
    if (cached) return cached

    const existing = contributors.get(id)
    if (!existing) {
      return cacheResult('update', idempotencyKey, rejected('update', 'NOT_FOUND', 'Contributor not found'))
    }

    let dni = existing.dni
    if (input.dni !== undefined) {
      try {
        dni = normalizeDni(input.dni)
      } catch {
        return cacheResult(
          'update',
          idempotencyKey,
          rejected('update', 'INVALID_INPUT', 'DNI must contain only digits'),
        )
      }
    }

    const fields = [input.firstName, input.lastName, input.address, input.neighborhood]
    if (fields.some((value) => value !== undefined && !value.trim())) {
      return cacheResult(
        'update',
        idempotencyKey,
        rejected('update', 'INVALID_INPUT', 'Updated text fields cannot be empty'),
      )
    }

    const cuit = input.cuit === undefined ? existing.cuit : normalizeCuit(input.cuit)
    const duplicate = [...contributors.values()].some(
      (contributor) =>
        contributor.id !== id &&
        (contributor.dni === dni || (cuit !== undefined && contributor.cuit === cuit)),
    )
    if (duplicate) {
      return cacheResult('update', idempotencyKey, rejected('update', 'DUPLICATE', 'DNI or CUIT already exists'))
    }

    if (writeStatus !== 'confirmada') {
      return cacheResult(
        'update',
        idempotencyKey,
        createResult<PadronContributor>('update', writeStatus, undefined, errorForStatus(writeStatus)),
      )
    }

    const updated: PadronContributor = {
      ...existing,
      ...input,
      id,
      dni,
      cuit,
      firstName: input.firstName?.trim() ?? existing.firstName,
      lastName: input.lastName?.trim() ?? existing.lastName,
      birthDate: input.birthDate?.trim() ?? existing.birthDate,
      phone: input.phone?.trim() ?? existing.phone,
      address: input.address?.trim() ?? existing.address,
      neighborhood: input.neighborhood?.trim() ?? existing.neighborhood,
      isActive: input.isActive ?? existing.isActive,
    }
    contributors.set(id, updated)

    return cacheResult('update', idempotencyKey, createResult('update', 'confirmada', cloneContributor(updated)))
  }

  const deactivate = async (
    id: string,
    options: IdempotencyOptions,
  ): Promise<PadronResult<PadronContributor>> => {
    const idempotencyKey = options?.idempotencyKey?.trim()
    if (!idempotencyKey) {
      return rejected('deactivate', 'MISSING_IDEMPOTENCY_KEY', 'Idempotency key is required')
    }

    const cached = getCachedResult<PadronContributor>('deactivate', idempotencyKey)
    if (cached) return cached

    const existing = contributors.get(id)
    if (!existing) {
      return cacheResult('deactivate', idempotencyKey, rejected('deactivate', 'NOT_FOUND', 'Contributor not found'))
    }

    if (writeStatus !== 'confirmada') {
      return cacheResult(
        'deactivate',
        idempotencyKey,
        createResult<PadronContributor>(
          'deactivate',
          writeStatus,
          undefined,
          errorForStatus(writeStatus),
        ),
      )
    }

    const deactivated = { ...existing, isActive: false }
    contributors.set(id, deactivated)

    return cacheResult(
      'deactivate',
      idempotencyKey,
      createResult('deactivate', 'confirmada', cloneContributor(deactivated)),
    )
  }

  return {
    search,
    create,
    update,
    deactivate,
  }
}
