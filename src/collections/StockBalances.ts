import type { CollectionConfig } from 'payload'

import { inventoryOperator } from '../access/roles'
import { validateNonNegativeInteger, validateRequiredText } from '../inventory/field-validation'

export const StockBalances: CollectionConfig = {
  slug: 'stock-balances',
  labels: {
    plural: 'Saldos',
    singular: 'Saldo',
  },
  admin: {
    defaultColumns: ['product', 'lot', 'quantity', 'updatedAt'],
    useAsTitle: 'balanceKey',
  },
  access: {
    create: () => false,
    delete: () => false,
    read: inventoryOperator,
    update: () => false,
  },
  fields: [
    {
      name: 'balanceKey',
      type: 'text',
      required: true,
      unique: true,
      validate: validateRequiredText,
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
      name: 'quantity',
      type: 'number',
      min: 0,
      required: true,
      validate: validateNonNegativeInteger,
    },
  ],
  indexes: [{ fields: ['product', 'lot'] }],
  timestamps: true,
}
