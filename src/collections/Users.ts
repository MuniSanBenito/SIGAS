import { APIError } from 'payload'
import type { CollectionConfig } from 'payload'

import { adminOnly, adminOrSelf, hasRole, roleOptions } from '../access/roles'
import { normalizeDni } from '../normalizeDni'

const LAST_ADMIN_ERROR = 'No se puede quitar ni eliminar al último administrador.'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    plural: 'Usuarios',
    singular: 'Usuario',
  },
  admin: {
    useAsTitle: 'username',
  },
  auth: {
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
    },
  },
  access: {
    admin: adminOnly,
    create: adminOnly,
    delete: adminOnly,
    read: adminOrSelf,
    unlock: adminOnly,
    update: adminOrSelf,
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (!data?.username) return data

        const normalizedData = {
          ...data,
          username: normalizeDni(data.username),
        }

        if (operation !== 'create') return normalizedData

        const { totalDocs } = await req.payload.find({
          collection: 'users',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })

        return totalDocs === 0 ? { ...normalizedData, roles: ['admin'] } : normalizedData
      },
    ],
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (
          operation !== 'update' ||
          !originalDoc ||
          !hasRole(originalDoc, 'admin') ||
          !Object.prototype.hasOwnProperty.call(data, 'roles') ||
          hasRole(data, 'admin')
        ) {
          return data
        }

        const { totalDocs } = await req.payload.find({
          collection: 'users',
          depth: 0,
          limit: 2,
          overrideAccess: true,
          req,
          where: {
            roles: {
              in: ['admin'],
            },
          },
        })

        if (totalDocs <= 1) throw new APIError(LAST_ADMIN_ERROR, 403)

        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        if (id == null) return

        const user = await req.payload.findByID({
          collection: 'users',
          depth: 0,
          id,
          overrideAccess: true,
          req,
        })

        if (!hasRole(user, 'admin')) return

        const { totalDocs } = await req.payload.find({
          collection: 'users',
          depth: 0,
          limit: 2,
          overrideAccess: true,
          req,
          where: {
            roles: {
              in: ['admin'],
            },
          },
        })

        if (totalDocs <= 1) throw new APIError(LAST_ADMIN_ERROR, 403)
      },
    ],
  },
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: roleOptions,
      saveToJWT: true,
      access: {
        create: adminOnly,
        read: adminOrSelf,
        update: adminOnly,
      },
    },
    // Email added by default
    // Add more fields as needed
  ],
}
