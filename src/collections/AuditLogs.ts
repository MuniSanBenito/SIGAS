import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/roles'
import { validateRequiredText } from '../inventory/field-validation'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    defaultColumns: ['createdAt', 'module', 'action', 'targetType', 'targetId', 'result', 'actor'],
    useAsTitle: 'action',
  },
  access: {
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  fields: [
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'actorRoles',
      type: 'json',
      required: true,
    },
    {
      name: 'module',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'action',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'targetType',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'targetId',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'reason',
      type: 'textarea',
    },
    {
      name: 'context',
      type: 'json',
    },
    {
      name: 'before',
      type: 'json',
    },
    {
      name: 'after',
      type: 'json',
    },
    {
      name: 'result',
      type: 'select',
      options: ['success', 'rejected', 'replayed'],
      required: true,
    },
  ],
  timestamps: true,
}
