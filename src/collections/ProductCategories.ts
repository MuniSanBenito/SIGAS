import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const ProductCategories: CollectionConfig = {
  slug: 'product-categories',
  labels: {
    plural: 'Categorías de producto',
    singular: 'Categoría de producto',
  },
  admin: {
    defaultColumns: ['name', 'isActive', 'updatedAt'],
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
      unique: true,
      validate: validateRequiredText,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
  ],
  timestamps: true,
}
