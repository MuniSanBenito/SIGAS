import type { CollectionConfig } from 'payload'

import { groupOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const FamilyGroups: CollectionConfig = {
  slug: 'family-groups',
  admin: {
    defaultColumns: ['referenteContributorId', 'status', 'startedAt', 'updatedAt'],
    useAsTitle: 'referenteContributorId',
  },
  access: {
    create: groupOperator,
    delete: () => false,
    read: groupOperator,
    update: groupOperator,
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Activo', value: 'active' },
        { label: 'Inactivo', value: 'inactive' },
      ],
    },
    {
      name: 'referenteContributorId',
      type: 'text',
      required: true,
      validate: validateRequiredText,
      index: true,
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'endedAt',
      type: 'date',
    },
    {
      name: 'endReason',
      type: 'textarea',
    },
    {
      name: 'observations',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
