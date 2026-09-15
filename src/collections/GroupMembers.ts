import type { CollectionConfig } from 'payload'

import { groupOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const GroupMembers: CollectionConfig = {
  slug: 'group-members',
  admin: {
    defaultColumns: ['group', 'contributorId', 'isReferent', 'status', 'startedAt'],
    useAsTitle: 'contributorId',
  },
  access: {
    create: groupOperator,
    delete: () => false,
    read: groupOperator,
    update: groupOperator,
  },
  fields: [
    {
      name: 'group',
      type: 'relationship',
      relationTo: 'family-groups',
      required: true,
      index: true,
    },
    {
      name: 'contributorId',
      type: 'text',
      required: true,
      validate: validateRequiredText,
      index: true,
    },
    {
      name: 'kinship',
      type: 'relationship',
      relationTo: 'kinship-relations',
      required: true,
    },
    {
      name: 'isReferent',
      type: 'checkbox',
      defaultValue: false,
      required: true,
    },
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
      name: 'multiGroupReason',
      type: 'textarea',
    },
    {
      name: 'kinshipObservation',
      type: 'text',
    },
  ],
  timestamps: true,
}
