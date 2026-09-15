import type { Endpoint } from 'payload'

import { hasAnyRole } from '@/access/roles'
import {
  createContribuyente,
  ExternalApiError,
  findContribuyentes,
  getContribuyenteById,
  updateContribuyente,
} from '@/integrations/padron/san-benito-client'
import { mapFormToExternalPayload, type ContribuyenteFormBody } from '@/lib/contribuyente-map'

type ContribuyenteRequest = {
  user?: unknown
  url?: string
  routeParams?: Record<string, string | undefined>
  json?: () => Promise<unknown>
}

function requestUrl(req: ContribuyenteRequest): URL {
  if (!req.url) throw new Error('Request URL unavailable')
  return new URL(req.url)
}

async function requestBody(req: ContribuyenteRequest): Promise<ContribuyenteFormBody> {
  const body = typeof req.json === 'function' ? await req.json() : undefined
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  return body as ContribuyenteFormBody
}

function authorize(req: ContribuyenteRequest): void {
  if (!req.user) throw new ContribuyenteEndpointError('AUTHENTICATION_REQUIRED', 'La sesión es obligatoria.', 401)
  if (!hasAnyRole(req.user, ['admin', 'administracion'])) {
    throw new ContribuyenteEndpointError('FORBIDDEN', 'No tenés permisos para administrar contribuyentes.', 403)
  }
}

function responseError(error: unknown): Response {
  if (error instanceof ContribuyenteEndpointError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  if (error instanceof ExternalApiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502
    return Response.json(
      { error: { code: 'EXTERNAL_API_ERROR', message: error.message } },
      { status },
    )
  }
  console.error('[contribuyentes] endpoint error', error)
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' } },
    { status: 500 },
  )
}

class ContribuyenteEndpointError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function listEndpoint(req: ContribuyenteRequest): Promise<Response> {
  try {
    authorize(req)
    return Response.json(await findContribuyentes(requestUrl(req).searchParams))
  } catch (error) {
    return responseError(error)
  }
}

async function createEndpoint(req: ContribuyenteRequest): Promise<Response> {
  try {
    authorize(req)
    const { data, error } = mapFormToExternalPayload(await requestBody(req))
    if (error) throw new ContribuyenteEndpointError('VALIDATION_ERROR', error, 422)
    return Response.json(await createContribuyente(data), { status: 201 })
  } catch (error) {
    return responseError(error)
  }
}

async function getEndpoint(req: ContribuyenteRequest): Promise<Response> {
  try {
    authorize(req)
    const id = req.routeParams?.id || ''
    return Response.json(await getContribuyenteById(id))
  } catch (error) {
    return responseError(error)
  }
}

async function updateEndpoint(req: ContribuyenteRequest): Promise<Response> {
  try {
    authorize(req)
    const id = req.routeParams?.id || ''
    const { data, error } = mapFormToExternalPayload(await requestBody(req), { requireName: false })
    if (error) throw new ContribuyenteEndpointError('VALIDATION_ERROR', error, 422)
    return Response.json(await updateContribuyente(id, data))
  } catch (error) {
    return responseError(error)
  }
}

export const contribuyenteEndpoints: Endpoint[] = [
  { handler: (req) => listEndpoint(req as ContribuyenteRequest), method: 'get', path: '/contribuyentes' },
  { handler: (req) => createEndpoint(req as ContribuyenteRequest), method: 'post', path: '/contribuyentes' },
  { handler: (req) => getEndpoint(req as ContribuyenteRequest), method: 'get', path: '/contribuyentes/:id' },
  { handler: (req) => updateEndpoint(req as ContribuyenteRequest), method: 'patch', path: '/contribuyentes/:id' },
]
