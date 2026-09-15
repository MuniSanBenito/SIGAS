import type { Endpoint } from 'payload'

import { canAccessModule } from '@/access/roles'
import { GroupError, groupErrorResponse } from '@/groups/errors'
import {
  addGroupMember,
  checkContributorMemberships,
  createGroup,
  deactivateGroupMember,
  getGroupById,
  listGroups,
  listKinships,
  updateGroup,
  type GroupRequest,
} from '@/groups/group-service'
import type { User } from '@/payload-types'

type GrupoRequest = GroupRequest & {
  routeParams?: Record<string, string | undefined>
}

function authorize(req: GrupoRequest): User {
  if (!req.user) throw new GroupError('UNAUTHENTICATED', 'La sesión es obligatoria.', 401)
  if (!canAccessModule(req.user, 'groups')) {
    throw new GroupError('FORBIDDEN', 'No tenés permisos para administrar grupos familiares.', 403)
  }
  return req.user
}

function requestUrl(req: GrupoRequest): URL {
  if (!req.url) throw new GroupError('INTERNAL_ERROR', 'URL de solicitud no disponible.', 500)
  return new URL(req.url)
}

async function requestBody(req: GrupoRequest): Promise<unknown> {
  if (typeof req.json === 'function') return req.json()
  return req.data
}

async function listGroupsEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const url = requestUrl(req)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '15', 10) || 15))
    const search = url.searchParams.get('search') ?? undefined
    const statusParam = url.searchParams.get('status')
    const status =
      statusParam === 'active' || statusParam === 'inactive' || statusParam === 'all' ? statusParam : 'active'

    const result = await listGroups(req, { limit, page, search, status })
    return Response.json(result)
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function createGroupEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const group = await createGroup(req, await requestBody(req))
    return Response.json({ doc: group }, { status: 201 })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function getGroupEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const id = req.routeParams?.id ?? ''
    const group = await getGroupById(req, id)
    return Response.json({ doc: group })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function updateGroupEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const id = req.routeParams?.id ?? ''
    const group = await updateGroup(req, id, await requestBody(req))
    return Response.json({ doc: group })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function addMemberEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const id = req.routeParams?.id ?? ''
    const group = await addGroupMember(req, id, await requestBody(req))
    return Response.json({ doc: group })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function deactivateMemberEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const groupId = req.routeParams?.id ?? ''
    const memberId = req.routeParams?.memberId ?? ''
    const group = await deactivateGroupMember(req, groupId, memberId, await requestBody(req))
    return Response.json({ doc: group })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function listKinshipsEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const docs = await listKinships(req)
    return Response.json({ docs })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

async function checkMembershipsEndpoint(req: GrupoRequest): Promise<Response> {
  try {
    authorize(req)
    const url = requestUrl(req)
    const contributorId = url.searchParams.get('contributorId') ?? ''
    const excludeGroupId = url.searchParams.get('excludeGroupId') ?? undefined
    if (!contributorId) {
      throw new GroupError('VALIDATION_ERROR', 'contributorId es obligatorio.', 422)
    }
    const memberships = await checkContributorMemberships(req, contributorId, excludeGroupId)
    return Response.json({ memberships })
  } catch (error) {
    return groupErrorResponse(error)
  }
}

export const groupEndpoints: Endpoint[] = [
  { handler: (req) => listGroupsEndpoint(req as GrupoRequest), method: 'get', path: '/grupos' },
  { handler: (req) => createGroupEndpoint(req as GrupoRequest), method: 'post', path: '/grupos' },
  { handler: (req) => checkMembershipsEndpoint(req as GrupoRequest), method: 'get', path: '/grupos/membresias' },
  { handler: (req) => getGroupEndpoint(req as GrupoRequest), method: 'get', path: '/grupos/:id' },
  { handler: (req) => updateGroupEndpoint(req as GrupoRequest), method: 'patch', path: '/grupos/:id' },
  { handler: (req) => addMemberEndpoint(req as GrupoRequest), method: 'post', path: '/grupos/:id/miembros' },
  {
    handler: (req) => deactivateMemberEndpoint(req as GrupoRequest),
    method: 'patch',
    path: '/grupos/:id/miembros/:memberId',
  },
  { handler: (req) => listKinshipsEndpoint(req as GrupoRequest), method: 'get', path: '/parentescos' },
]
