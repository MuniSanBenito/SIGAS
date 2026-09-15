import type { CollectionConfig } from 'payload'

import { deliveryOperator } from '../access/roles'
import { validatePositiveInteger, validateRequiredText } from '../inventory/field-validation'

export const DeliveryLines: CollectionConfig = {
  slug: 'delivery-lines',
  admin: {
    defaultColumns: ['delivery', 'product', 'lot', 'quantity'],
    useAsTitle: 'operationKey',
  },
  access: {
    create: deliveryOperator,
    delete: () => false,
    read: deliveryOperator,
    update: deliveryOperator,
  },
  fields: [
    {
      name: 'delivery',
      type: 'relationship',
      relationTo: 'deliveries',
      required: true,
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
    },
    {
      name: 'lot',
      type: 'relationship',
      relationTo: 'product-lots',
    },
    {
      name: 'bundleVersion',
      type: 'relationship',
      relationTo: 'bundle-versions',
    },
    {
      name: 'quantity',
      type: 'number',
      min: 1,
      required: true,
      validate: validatePositiveInteger,
    },
    {
      name: 'observation',
      type: 'textarea',
    },
    {
      name: 'operationKey',
      type: 'text',
      required: true,
      unique: true,
      validate: validateRequiredText,
    },
  ],
  indexes: [{ fields: ['delivery'] }],
  timestamps: true,
}
