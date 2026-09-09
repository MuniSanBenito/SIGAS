import { APIError } from 'payload'
import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validateNonNegativeInteger, validateRequiredText } from '../inventory/field-validation'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    defaultColumns: ['name', 'category', 'tracksLotExpiration', 'minimumStock', 'isActive', 'updatedAt'],
    useAsTitle: 'name',
  },
  access: {
    create: inventoryOperator,
    delete: () => false,
    read: inventoryOperator,
    update: inventoryOperator,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'product-categories',
      required: true,
    },
    {
      name: 'tracksLotExpiration',
      type: 'checkbox',
      defaultValue: false,
      required: true,
    },
    {
      name: 'minimumStock',
      type: 'number',
      defaultValue: 0,
      min: 0,
      required: true,
      validate: validateNonNegativeInteger,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'inactiveReason',
      type: 'text',
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const isActive = data.isActive ?? originalDoc?.isActive ?? true
        const inactiveReason = data.inactiveReason ?? originalDoc?.inactiveReason

        if (!isActive && !(typeof inactiveReason === 'string' && inactiveReason.trim())) {
          throw new APIError('El motivo de baja del producto es obligatorio.', 422)
        }

        if (
          operation === 'update' &&
          originalDoc &&
          Object.prototype.hasOwnProperty.call(data, 'tracksLotExpiration') &&
          data.tracksLotExpiration !== originalDoc.tracksLotExpiration
        ) {
          const { totalDocs } = await req.payload.find({
            collection: 'stock-movements',
            depth: 0,
            limit: 1,
            overrideAccess: true,
            req,
            where: {
              product: {
                equals: originalDoc.id,
              },
            },
          })

          if (totalDocs > 0) {
            throw new APIError('No se puede cambiar el control de lote después del primer movimiento.', 409)
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
