import type { CollectionConfig } from 'payload'

import { deliveryOperator } from '../access/roles'
import { validatePositiveInteger } from '../inventory/field-validation'

export const DeliveryBundles: CollectionConfig = {
  slug: 'delivery-bundles',
  labels: {
    plural: 'Bolsones de entrega',
    singular: 'Bolsón de entrega',
  },
  admin: {
    defaultColumns: ['delivery', 'bundleVersion', 'quantity'],
    useAsTitle: 'id',
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
      name: 'bundleVersion',
      type: 'relationship',
      relationTo: 'bundle-versions',
      required: true,
    },
    {
      name: 'quantity',
      type: 'number',
      min: 1,
      required: true,
      validate: validatePositiveInteger,
    },
    {
      name: 'modificationNote',
      type: 'textarea',
    },
  ],
  indexes: [{ fields: ['delivery'] }],
  timestamps: true,
}
