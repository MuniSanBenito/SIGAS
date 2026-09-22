import type { CollectionConfig } from 'payload'

import { deliveryOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const Deliveries: CollectionConfig = {
  slug: 'deliveries',
  labels: {
    plural: 'Entregas',
    singular: 'Entrega',
  },
  admin: {
    defaultColumns: ['group', 'deliveryDate', 'receiverContributorId', 'confirmedAt'],
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
      name: 'group',
      type: 'relationship',
      relationTo: 'family-groups',
      required: true,
    },
    {
      name: 'deliveryDate',
      type: 'date',
      required: true,
    },
    {
      name: 'confirmedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'confirmedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'receiverContributorId',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'receiverIsThirdParty',
      type: 'checkbox',
      defaultValue: false,
      required: true,
    },
    {
      name: 'receiverAuthorizationReason',
      type: 'textarea',
    },
    {
      name: 'observations',
      type: 'textarea',
    },
    {
      name: 'recipeDiffReason',
      type: 'textarea',
    },
    {
      name: 'operationKey',
      type: 'text',
      required: true,
      unique: true,
      validate: validateRequiredText,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'confirmed',
      options: ['confirmed'],
      required: true,
    },
  ],
  indexes: [{ fields: ['group', 'deliveryDate'] }],
  timestamps: true,
}
