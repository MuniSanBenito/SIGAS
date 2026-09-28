export type AccountErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CURRENT_PASSWORD'
  | 'LOCKED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'

export class AccountError extends Error {
  readonly code: AccountErrorCode
  readonly status: number

  constructor(code: AccountErrorCode, message: string, status: number) {
    super(message)
    this.name = 'AccountError'
    this.code = code
    this.status = status
  }
}

export function accountErrorResponse(error: unknown): Response {
  if (error instanceof AccountError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }

  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'No se pudo cambiar la contraseña.' } },
    { status: 500 },
  )
}
