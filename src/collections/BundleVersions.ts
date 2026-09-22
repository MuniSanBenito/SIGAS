import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validatePositiveInteger } from '../inventory/field-validation'

export const BundleVersions: CollectionConfig = {
  slug: 'bundle-versions',
  labels: {
    plural: 'Versiones de bolsón',
    singular: 'Versión de bolsón',
  },
  admin: {
    defaultColumns: ['bundle', 'version', 'status', 'effectiveFrom', 'createdBy'],
    useAsTitle: 'version',
  },
  access: {
    create: () => false,
    delete: () => false,
    read: inventoryOperator,
    update: () => false,
  },
  fields: [
    {
      name: 'bundle',
      type: 'relationship',
      relationTo: 'bundles',
      required: true,
    },
    {
      name: 'version',
      type: 'number',
      min: 1,
      required: true,
      validate: validatePositiveInteger,
    },
    {
      name: 'status',
      type: 'select',
      options: ['current', 'historical'],
      required: true,
    },
    {
      name: 'effectiveFrom',
      type: 'date',
      required: true,
    },
    {
      name: 'effectiveTo',
      type: 'date',
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'lines',
      type: 'array',
      minRows: 1,
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          min: 1,
          required: true,
          validate: validatePositiveInteger,
        },
      ],
    },
  ],
  indexes: [{ fields: ['bundle', 'version'], unique: true }],
  timestamps: true,
}
