export type GroupErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export class GroupError extends Error {
  readonly code: GroupErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: GroupErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'GroupError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function groupErrorResponse(error: unknown): Response {
  if (error instanceof GroupError) {
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
        message: 'No se pudo completar la operación de grupos.',
      },
    },
    { status: 500 },
  )
}
