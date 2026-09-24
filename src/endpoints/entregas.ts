import type { Endpoint } from 'payload'

import { canAccessModule } from '@/access/roles'
import { deliveryErrorResponse, DeliveryError } from '@/deliveries/errors'
import {
  buildProposal,
  confirmDelivery,
  getDeliveryById,
  listDeliveries,
  listDeliveryCatalog,
  returnOrthopedicAssistance,
  type DeliveryRequest,
} from '@/deliveries/delivery-service'
import type { User } from '@/payload-types'

type EntregaRequest = DeliveryRequest & {
  routeParams?: Record<string, string | undefined>
}

function authorize(req: EntregaRequest): User {
  if (!req.user) throw new DeliveryError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)
  if (!canAccessModule(req.user, 'deliveries')) {
    throw new DeliveryError('FORBIDDEN', 'No tenés permiso para operar entregas.', 403)
  }
  return req.user
}

async function requestBody(req: EntregaRequest): Promise<unknown> {
  if (typeof req.json === 'function') return req.json()
  return req.data
}

function requestUrl(req: EntregaRequest): URL {
  if (!req.url) throw new DeliveryError('INTERNAL_ERROR', 'URL de solicitud no disponible.', 500)
  return new URL(req.url)
}

async function listDeliveriesEndpoint(req: EntregaRequest): Promise<Response> {
  try {
    authorize(req)
    const url = requestUrl(req)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '15', 10) || 15))
    return Response.json(await listDeliveries(req, { limit, page }))
  } catch (error) {
    return deliveryErrorResponse(error)
  }
}

async function getDeliveryEndpoint(req: EntregaRequest): Promise<Response> {
  try {
    authorize(req)
    const id = req.routeParams?.id ?? ''
    return Response.json({ doc: await getDeliveryById(req, id) })
  } catch (error) {
    return deliveryErrorResponse(error)
  }
}

async function catalogEndpoint(req: EntregaRequest): Promise<Response> {
  try {
    authorize(req)
    return Response.json(await listDeliveryCatalog(req))
  } catch (error) {
    return deliveryErrorResponse(error)
  }
}

async function proposalEndpoint(req: EntregaRequest): Promise<Response> {
  try {
    authorize(req)
    return Response.json(await buildProposal(req, await requestBody(req)))
  } catch (error) {
    return deliveryErrorResponse(error)
  }
}

async function confirmDeliveryEndpoint(req: EntregaRequest): Promise<Response> {
  try {
    authorize(req)
    const delivery = await confirmDelivery(req, await requestBody(req))
    return Response.json({ doc: delivery }, { status: 201 })
  } catch (error) {
    return deliveryErrorResponse(error)
  }
}

async function returnAssistanceEndpoint(req: EntregaRequest): Promise<Response> {
  try {
    authorize(req)
    const deliveryId = req.routeParams?.id ?? ''
    const assistanceId = req.routeParams?.assistanceId ?? ''
    const delivery = await returnOrthopedicAssistance(req, deliveryId, assistanceId)
    return Response.json({ doc: delivery })
  } catch (error) {
    return deliveryErrorResponse(error)
  }
}

export const deliveryEndpoints: Endpoint[] = [
  { handler: (req) => listDeliveriesEndpoint(req as EntregaRequest), method: 'get', path: '/entregas' },
  { handler: (req) => catalogEndpoint(req as EntregaRequest), method: 'get', path: '/entregas/catalogo' },
  { handler: (req) => proposalEndpoint(req as EntregaRequest), method: 'post', path: '/entregas/propuesta' },
  { handler: (req) => confirmDeliveryEndpoint(req as EntregaRequest), method: 'post', path: '/entregas' },
  {
    handler: (req) => returnAssistanceEndpoint(req as EntregaRequest),
    method: 'post',
    path: '/entregas/:id/asistencias/:assistanceId/devolver',
  },
  { handler: (req) => getDeliveryEndpoint(req as EntregaRequest), method: 'get', path: '/entregas/:id' },
]
