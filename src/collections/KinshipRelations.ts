import type { CollectionConfig } from 'payload'

import { groupOperator } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const DEFAULT_KINSHIP_RELATIONS = [
  { code: 'referente', label: 'Referente', requiresObservation: false, sortOrder: 1 },
  { code: 'conyuge', label: 'Cónyuge', requiresObservation: false, sortOrder: 2 },
  { code: 'hijo', label: 'Hijo/a', requiresObservation: false, sortOrder: 3 },
  { code: 'padre', label: 'Padre/Madre', requiresObservation: false, sortOrder: 4 },
  { code: 'hermano', label: 'Hermano/a', requiresObservation: false, sortOrder: 5 },
  { code: 'nieto', label: 'Nieto/a', requiresObservation: false, sortOrder: 6 },
  { code: 'otro', label: 'Otro', requiresObservation: true, sortOrder: 7 },
] as const

export const KinshipRelations: CollectionConfig = {
  slug: 'kinship-relations',
  labels: {
    plural: 'Parentescos',
    singular: 'Parentesco',
  },
  admin: {
    defaultColumns: ['label', 'code', 'isActive', 'sortOrder'],
    useAsTitle: 'label',
  },
  access: {
    create: groupOperator,
    delete: () => false,
    read: groupOperator,
    update: groupOperator,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      validate: validateRequiredText,
    },
    {
      name: 'requiresObservation',
      type: 'checkbox',
      defaultValue: false,
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'sortOrder',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
  ],
  timestamps: true,
}
