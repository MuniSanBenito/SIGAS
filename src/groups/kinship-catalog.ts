import type { PayloadRequest } from 'payload'

import { DEFAULT_KINSHIP_RELATIONS } from '../collections/KinshipRelations'
import type { KinshipRelation } from '../payload-types'
import { GroupError } from './errors'

export async function ensureKinshipCatalog(req: PayloadRequest): Promise<KinshipRelation[]> {
  const existing = await req.payload.find({
    collection: 'kinship-relations',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
    sort: 'sortOrder',
  })

  if (existing.totalDocs > 0) {
    return existing.docs as KinshipRelation[]
  }

  const created: KinshipRelation[] = []
  for (const item of DEFAULT_KINSHIP_RELATIONS) {
    const doc = await req.payload.create({
      collection: 'kinship-relations',
      data: {
        code: item.code,
        isActive: true,
        label: item.label,
        requiresObservation: item.requiresObservation,
        sortOrder: item.sortOrder,
      },
      overrideAccess: true,
      req,
    })
    created.push(doc as KinshipRelation)
  }

  return created
}

export async function getReferenteKinship(req: PayloadRequest): Promise<KinshipRelation> {
  const catalog = await ensureKinshipCatalog(req)
  const referente = catalog.find((item) => item.code === 'referente')
  if (!referente) {
    throw new GroupError('INTERNAL_ERROR', 'No se encontró el parentesco Referente.', 500)
  }
  return referente
}

export async function getKinshipById(req: PayloadRequest, kinshipId: string): Promise<KinshipRelation> {
  const kinship = await req.payload.findByID({
    collection: 'kinship-relations',
    depth: 0,
    id: kinshipId,
    overrideAccess: true,
    req,
  })

  if (!kinship || !(kinship as KinshipRelation).isActive) {
    throw new GroupError('VALIDATION_ERROR', 'El parentesco seleccionado no es válido.', 422)
  }

  const relation = kinship as KinshipRelation
  return relation
}

export function assertKinshipObservation(kinship: KinshipRelation, observation?: string): void {
  if (kinship.requiresObservation && !observation?.trim()) {
    throw new GroupError('VALIDATION_ERROR', 'Debe indicar una observación para el parentesco Otro.', 422)
  }
}
