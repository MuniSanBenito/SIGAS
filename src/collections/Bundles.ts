import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const Bundles: CollectionConfig = {
  slug: 'bundles',
  labels: {
    plural: 'Bolsones',
    singular: 'Bolsón',
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
      name: 'description',
      type: 'textarea',
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
