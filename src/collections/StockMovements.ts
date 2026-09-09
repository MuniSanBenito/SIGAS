import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validateNonNegativeInteger, validatePositiveInteger, validateRequiredText } from '../inventory/field-validation'

export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',
  admin: {
    defaultColumns: ['operationalDate', 'movementType', 'product', 'lot', 'quantity', 'reason', 'createdBy'],
    useAsTitle: 'operationKey',
  },
  access: {
    create: () => false,
    delete: () => false,
    read: inventoryOperator,
    update: () => false,
  },
  fields: [
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
      name: 'movementType',
      type: 'select',
      options: ['entry', 'exit', 'adjustment'],
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
      name: 'adjustmentDirection',
      type: 'select',
      options: ['increase', 'decrease'],
    },
    {
      name: 'adjustmentMode',
      type: 'select',
      options: ['manual', 'physicalCount'],
    },
    {
      name: 'reason',
      type: 'text',
      required: true,
      validate: validateRequiredText,
    },
    {
      name: 'operationalDate',
      type: 'date',
      required: true,
    },
    {
      name: 'source',
      type: 'text',
    },
    {
      name: 'observation',
      type: 'textarea',
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'operationKey',
      type: 'text',
      required: true,
      unique: true,
      validate: validateRequiredText,
    },
    {
      name: 'previousQuantity',
      type: 'number',
      min: 0,
      required: true,
      validate: validateNonNegativeInteger,
    },
    {
      name: 'resultingQuantity',
      type: 'number',
      min: 0,
      required: true,
      validate: validateNonNegativeInteger,
    },
    {
      name: 'correctionOf',
      type: 'relationship',
      relationTo: 'stock-movements',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: ['active', 'corrected'],
      required: true,
    },
  ],
  indexes: [
    { fields: ['product', 'operationalDate'] },
    { fields: ['lot', 'operationalDate'] },
  ],
  timestamps: true,
}
