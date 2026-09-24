import { DeliveryError } from './errors'
import {
  assistanceKinds,
  type AssistanceKind,
  type ConfirmDeliveryInput,
  type DeliveryAssistanceInput,
  type DeliveryBundleSelection,
  type DeliveryRealLine,
  type ProposalInput,
  type ProposedLine,
} from './types'

export { DeliveryError }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DeliveryError('VALIDATION_ERROR', `${field} es obligatorio.`, 422)
  }
  return value.trim()
}

function optionalString(value: unknown, field: string, maxLength = 2000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new DeliveryError('VALIDATION_ERROR', `${field} debe ser texto.`, 422)
  }
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length > maxLength) {
    throw new DeliveryError('VALIDATION_ERROR', `${field} es demasiado largo.`, 422)
  }
  return trimmed
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new DeliveryError('VALIDATION_ERROR', `${field} debe ser un entero positivo.`, 422)
  }
  return value
}

function deliveryDate(value: unknown): string {
  const date = requiredString(value, 'deliveryDate')
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (!DATE_PATTERN.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new DeliveryError('VALIDATION_ERROR', 'deliveryDate debe ser una fecha válida YYYY-MM-DD.', 422)
  }
  return date
}

function parseBundleSelection(value: unknown): DeliveryBundleSelection {
  if (!isRecord(value)) {
    throw new DeliveryError('VALIDATION_ERROR', 'Cada bolsón debe ser un objeto.', 422)
  }
  return {
    bundleVersionId: requiredString(value.bundleVersionId, 'bundleVersionId'),
    quantity: positiveInteger(value.quantity, 'quantity'),
    modificationNote: optionalString(value.modificationNote, 'modificationNote'),
  }
}

function parseRealLine(value: unknown): DeliveryRealLine {
  if (!isRecord(value)) {
    throw new DeliveryError('VALIDATION_ERROR', 'Cada línea real debe ser un objeto.', 422)
  }
  const bundleVersionId = optionalString(value.bundleVersionId, 'bundleVersionId')
  return {
    productId: requiredString(value.productId, 'productId'),
    lotId: optionalString(value.lotId, 'lotId'),
    quantity: positiveInteger(value.quantity, 'quantity'),
    ...(bundleVersionId ? { bundleVersionId } : {}),
    observation: optionalString(value.observation, 'observation'),
  }
}

const quantityKinds = new Set<AssistanceKind>(['materials', 'funeral', 'medication', 'orthopedic'])

function parseAssistance(value: unknown): DeliveryAssistanceInput {
  if (!isRecord(value)) {
    throw new DeliveryError('VALIDATION_ERROR', 'Cada asistencia debe ser un objeto.', 422)
  }
  const kind = requiredString(value.kind, 'kind')
  if (!assistanceKinds.includes(kind as AssistanceKind)) {
    throw new DeliveryError('VALIDATION_ERROR', 'Tipo de asistencia no válido.', 422)
  }
  const assistanceKind = kind as AssistanceKind
  const description = requiredString(value.description, 'description')
  const hasQuantity = value.quantity !== undefined && value.quantity !== null && value.quantity !== ''
  const hasAmount = value.amountPesos !== undefined && value.amountPesos !== null && value.amountPesos !== ''

  if (assistanceKind === 'money') {
    if (hasQuantity) {
      throw new DeliveryError('VALIDATION_ERROR', 'El dinero no lleva cantidad.', 422)
    }
    return {
      kind: assistanceKind,
      description,
      amountPesos: positiveInteger(value.amountPesos, 'amountPesos'),
    }
  }

  if (hasAmount) {
    throw new DeliveryError('VALIDATION_ERROR', 'Esta asistencia no lleva monto.', 422)
  }

  if (assistanceKind === 'atmospheric') {
    if (hasQuantity) {
      throw new DeliveryError('VALIDATION_ERROR', 'El subsidio atmosférico no lleva cantidad.', 422)
    }
    return { kind: assistanceKind, description }
  }

  if (!quantityKinds.has(assistanceKind)) {
    throw new DeliveryError('VALIDATION_ERROR', 'Tipo de asistencia no válido.', 422)
  }

  if (!hasQuantity) {
    throw new DeliveryError('VALIDATION_ERROR', 'La cantidad es obligatoria.', 422)
  }

  return {
    kind: assistanceKind,
    description,
    quantity: positiveInteger(value.quantity, 'quantity'),
  }
}

function assertNoDuplicateBundles(bundles: DeliveryBundleSelection[]): void {
  const seen = new Set<string>()
  for (const bundle of bundles) {
    if (seen.has(bundle.bundleVersionId)) {
      throw new DeliveryError('VALIDATION_ERROR', 'Un bolsón no puede repetirse en la misma entrega.', 422)
    }
    seen.add(bundle.bundleVersionId)
  }
}

function assertNoDuplicateLines(lines: DeliveryRealLine[]): void {
  const seen = new Set<string>()
  for (const line of lines) {
    const key = `${line.productId}:${line.lotId ?? 'general'}:${line.bundleVersionId ?? 'suelto'}`
    if (seen.has(key)) {
      throw new DeliveryError('VALIDATION_ERROR', 'Una línea real no puede repetirse en la misma entrega.', 422)
    }
    seen.add(key)
  }
}

function rejectPersonDestination(input: Record<string, unknown>): void {
  if (input.destinoTipo !== undefined && input.destinoTipo !== 'grupo') {
    throw new DeliveryError('VALIDATION_ERROR', 'El destino de la entrega siempre es un grupo familiar.', 422)
  }
  for (const field of ['destinatarioContribuyenteId', 'motivoEntregaSinGrupo', 'destinatario_contribuyente_id']) {
    if (input[field] !== undefined && input[field] !== null && input[field] !== '') {
      throw new DeliveryError('VALIDATION_ERROR', 'El destino de la entrega siempre es un grupo familiar.', 422)
    }
  }
}

export function parseConfirmDeliveryInput(input: unknown): ConfirmDeliveryInput {
  if (!isRecord(input)) {
    throw new DeliveryError('VALIDATION_ERROR', 'El cuerpo de la solicitud debe ser un objeto.', 422)
  }

  rejectPersonDestination(input)

  const bundles = Array.isArray(input.bundles) ? input.bundles.map(parseBundleSelection) : []
  if (!Array.isArray(input.bundles) && input.bundles !== undefined) {
    throw new DeliveryError('VALIDATION_ERROR', 'bundles debe ser un arreglo.', 422)
  }

  const lines = Array.isArray(input.lines) ? input.lines.map(parseRealLine) : []
  if (!Array.isArray(input.lines) && input.lines !== undefined) {
    throw new DeliveryError('VALIDATION_ERROR', 'lines debe ser un arreglo.', 422)
  }

  const assistances = Array.isArray(input.assistances) ? input.assistances.map(parseAssistance) : []
  if (!Array.isArray(input.assistances) && input.assistances !== undefined) {
    throw new DeliveryError('VALIDATION_ERROR', 'assistances debe ser un arreglo.', 422)
  }

  if (lines.length === 0 && assistances.length === 0) {
    throw new DeliveryError(
      'VALIDATION_ERROR',
      'La entrega debe incluir al menos un bolsón, un producto o una asistencia.',
      422,
    )
  }

  assertNoDuplicateBundles(bundles)
  assertNoDuplicateLines(lines)

  const receiverIsThirdParty = input.receiverIsThirdParty === true
  const receiverAuthorizationReason = optionalString(input.receiverAuthorizationReason, 'receiverAuthorizationReason')
  if (receiverIsThirdParty && !receiverAuthorizationReason) {
    throw new DeliveryError(
      'VALIDATION_ERROR',
      'Un receptor tercero requiere autorización y motivo.',
      422,
    )
  }

  return {
    groupId: requiredString(input.groupId, 'groupId'),
    receiverContributorId: requiredString(input.receiverContributorId, 'receiverContributorId'),
    receiverIsThirdParty,
    receiverAuthorizationReason,
    deliveryDate: deliveryDate(input.deliveryDate),
    observations: optionalString(input.observations, 'observations'),
    recipeDiffReason: optionalString(input.recipeDiffReason, 'recipeDiffReason'),
    operationKey: optionalString(input.operationKey, 'operationKey', 200),
    reportId: optionalString(input.reportId, 'reportId', 200),
    bundles,
    lines,
    assistances,
  }
}

export function parseProposalInput(input: unknown): ProposalInput {
  if (!isRecord(input)) {
    throw new DeliveryError('VALIDATION_ERROR', 'El cuerpo de la solicitud debe ser un objeto.', 422)
  }

  const bundles = Array.isArray(input.bundles)
    ? input.bundles.map((item) => {
        if (!isRecord(item)) {
          throw new DeliveryError('VALIDATION_ERROR', 'Cada bolsón debe ser un objeto.', 422)
        }
        return {
          bundleVersionId: requiredString(item.bundleVersionId, 'bundleVersionId'),
          quantity: positiveInteger(item.quantity, 'quantity'),
        }
      })
    : []

  const looseProducts = Array.isArray(input.looseProducts)
    ? input.looseProducts.map((item) => {
        if (!isRecord(item)) {
          throw new DeliveryError('VALIDATION_ERROR', 'Cada producto suelto debe ser un objeto.', 422)
        }
        return {
          productId: requiredString(item.productId, 'productId'),
          quantity: positiveInteger(item.quantity, 'quantity'),
        }
      })
    : []

  if (bundles.length === 0 && looseProducts.length === 0) {
    throw new DeliveryError('VALIDATION_ERROR', 'La propuesta debe incluir al menos un bolsón o un producto suelto.', 422)
  }

  return { bundles, looseProducts }
}

export function expandProposalLines(input: ProposalInput, getVersionLines: (bundleVersionId: string) => { productId: string; quantity: number }[]): ProposedLine[] {
  const proposed: ProposedLine[] = []

  for (const bundle of input.bundles) {
    const versionLines = getVersionLines(bundle.bundleVersionId)
    for (const line of versionLines) {
      proposed.push({
        productId: line.productId,
        quantity: line.quantity * bundle.quantity,
        bundleVersionId: bundle.bundleVersionId,
      })
    }
  }

  for (const loose of input.looseProducts) {
    proposed.push({ productId: loose.productId, quantity: loose.quantity })
  }

  return proposed
}

export function totalsByProduct(lines: { productId: string; quantity: number }[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity)
  }
  return totals
}

export function recipeTotalsDiffer(
  expected: Map<string, number>,
  actualLines: { productId: string; quantity: number }[],
): boolean {
  const actual = totalsByProduct(actualLines)
  if (expected.size !== actual.size) return true
  for (const [productId, quantity] of expected) {
    if (actual.get(productId) !== quantity) return true
  }
  return false
}

export function assertRecipeDiffReason(
  expected: Map<string, number>,
  actualLines: { productId: string; quantity: number }[],
  recipeDiffReason?: string,
): void {
  if (recipeTotalsDiffer(expected, actualLines) && !recipeDiffReason?.trim()) {
    throw new DeliveryError(
      'VALIDATION_ERROR',
      'Las líneas reales difieren de la receta. Debe indicar el motivo.',
      422,
    )
  }
}
