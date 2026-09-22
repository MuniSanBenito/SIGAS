export const MOVEMENT_REASON_LABELS: Record<string, string> = {
  adjustment: 'Ajuste',
  breakage: 'Rotura',
  delivery: 'Entrega',
  donation: 'Donación',
  expiration: 'Vencimiento',
  loss: 'Pérdida',
  physicalCount: 'Conteo',
  purchase: 'Compra',
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  adjustment: 'Ajuste',
  entry: 'Entrada',
  exit: 'Salida',
}

export const MOVEMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Vigente',
  corrected: 'Anulado',
}

export const BUNDLE_VERSION_STATUS_LABELS: Record<string, string> = {
  current: 'Vigente',
  historical: 'Anterior',
}

export const PRODUCT_ACTIVE_LABELS = {
  active: 'En uso',
  inactive: 'Dejó de usarse',
} as const

const ERROR_MESSAGE_LABELS: Record<string, string> = {
  'A lot is required for this product': 'Este producto requiere un lote.',
  'A reason is required': 'El motivo es obligatorio.',
  'A recipe cannot contain the same product twice': 'La receta no puede repetir el mismo producto.',
  'At least one field must be provided': 'Tenés que completar al menos un campo.',
  'At least one recipe line is required': 'La receta necesita al menos un producto.',
  'Authentication is required': 'Tenés que iniciar sesión.',
  'Correction movements cannot be corrected again': 'No se puede deshacer una corrección.',
  'Delivery movements must be corrected through delivery annulment':
    'Los movimientos de entrega se corrigen anulando la entrega.',
  'Expired lots cannot receive new stock': 'No se puede cargar stock en un lote vencido.',
  'Inactive bundles cannot receive new versions': 'Este bolsón ya no acepta versiones nuevas.',
  'Inactive lots cannot be used': 'El lote ya no está disponible.',
  'Inactive products cannot be added to a recipe': 'No podés usar un producto que dejó de usarse.',
  'Inactive products cannot receive new stock': 'Este producto ya no acepta entradas.',
  'Insufficient stock': 'No hay suficiente stock.',
  'Invalid recipe line': 'Hay una línea de receta inválida.',
  'Movement id is required': 'Falta el identificador del movimiento.',
  'Movement not found': 'No encontramos ese movimiento.',
  'Only active movements can be corrected': 'Solo se pueden deshacer movimientos vigentes.',
  'Product id is required': 'Falta el identificador del producto.',
  'Product is already active': 'El producto ya está en uso.',
  'Product is already inactive': 'El producto ya dejó de usarse.',
  'Product not found': 'No encontramos ese producto.',
  'Reason is not valid for this movement mode': 'El motivo no es válido para esta operación.',
  'Request body must be an object': 'La solicitud no es válida.',
  'Request URL is unavailable': 'No se pudo procesar la solicitud.',
  'The lot does not belong to the selected product': 'El lote no corresponde al producto elegido.',
  'The reason is too long': 'El motivo es demasiado largo.',
  'This product does not use lots': 'Este producto no usa lotes.',
  'Unable to determine movement delta': 'No se pudo calcular el movimiento.',
  'Unsupported stock movement': 'Operación de stock no soportada.',
  'You do not have inventory access': 'No tenés acceso al inventario.',
  'batchOperationKey is required': 'Falta la clave de la operación.',
  'batchOperationKey is too long': 'La clave de la operación es demasiado larga.',
  'lines must be a non-empty array': 'Agregá al menos un producto.',
  'lineKey is required': 'Falta la clave de la línea.',
  'lineKey is too long': 'La clave de la línea es demasiado larga.',
  'movement is required': 'Falta el movimiento.',
  'movement.mode is not supported': 'El tipo de operación no es válido.',
  'operationalDate must be a valid YYYY-MM-DD date': 'La fecha no es válida.',
  'operationKey is required': 'Falta la clave de la operación.',
  'operationKey is too long': 'La clave de la operación es demasiado larga.',
  'quantity must be a positive integer': 'La cantidad debe ser un número entero mayor a cero.',
  'countedQuantity must be a non-negative integer': 'La cantidad contada debe ser un número entero mayor o igual a cero.',
}

const ERROR_PATTERN_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^(.+) is required$/, label: 'Falta completar un dato obligatorio.' },
  { pattern: /^(.+) must be a string$/, label: 'Hay un dato con formato inválido.' },
  { pattern: /^(.+) is too long$/, label: 'Uno de los campos es demasiado largo.' },
  { pattern: /^(.+) must be a positive integer$/, label: 'La cantidad debe ser un número entero mayor a cero.' },
  { pattern: /^(.+) must be a non-negative integer$/, label: 'La cantidad debe ser un número entero mayor o igual a cero.' },
]

export function movementReasonLabel(reason: string): string {
  return MOVEMENT_REASON_LABELS[reason] ?? 'Otro'
}

export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] ?? type
}

export function inventoryErrorMessage(message: string): string {
  const direct = ERROR_MESSAGE_LABELS[message]
  if (direct) return direct

  for (const { pattern, label } of ERROR_PATTERN_LABELS) {
    if (pattern.test(message)) return label
  }

  if (/[a-z]/.test(message) && /[A-Z]/.test(message) && message.includes(' must ')) {
    return 'Revisá los datos ingresados e intentá de nuevo.'
  }

  return message
}
