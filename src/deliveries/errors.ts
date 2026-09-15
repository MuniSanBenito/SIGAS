export type DeliveryErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export class DeliveryError extends Error {
  readonly code: DeliveryErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: DeliveryErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'DeliveryError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function deliveryErrorResponse(error: unknown): Response {
  if (error instanceof DeliveryError) {
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
        message: 'No se pudo completar la operación de entregas.',
      },
    },
    { status: 500 },
  )
}
