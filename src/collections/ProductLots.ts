import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const ProductLots: CollectionConfig = {
  slug: 'product-lots',
  labels: {
    plural: 'Lotes',
    singular: 'Lote',
  },
  admin: {
    defaultColumns: ['product', 'code', 'expirationDate', 'isActive', 'updatedAt'],
    useAsTitle: 'code',
  },
  access: {
    create: inventoryOperator,
    delete: () => false,
    read: inventoryOperator,
    update: inventoryOperator,
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'expirationDate',
      type: 'date',
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
  ],
  indexes: [{ fields: ['product', 'code'], unique: true }],
  timestamps: true,
}
