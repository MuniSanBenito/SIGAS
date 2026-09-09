export type InventoryErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export class InventoryError extends Error {
  readonly code: InventoryErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: InventoryErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'InventoryError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function inventoryErrorResponse(error: unknown): Response {
  if (error instanceof InventoryError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status },
    )
  }

  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'No se pudo completar la operación de inventario.',
      },
    },
    { status: 500 },
  )
}
