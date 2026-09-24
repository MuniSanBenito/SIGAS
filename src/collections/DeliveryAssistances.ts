import type { CollectionConfig } from 'payload'

import { deliveryOperator } from '../access/roles'
import { assistanceKinds } from '../deliveries/types'

const quantityKinds = new Set(['materials', 'funeral', 'medication', 'orthopedic'])

export const DeliveryAssistances: CollectionConfig = {
  slug: 'delivery-assistances',
  labels: {
    plural: 'Asistencias de entrega',
    singular: 'Asistencia de entrega',
  },
  admin: {
    defaultColumns: ['delivery', 'kind', 'description', 'loanStatus'],
    useAsTitle: 'description',
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
      name: 'kind',
      type: 'select',
      options: [
        { label: 'Subsidio atmosférico', value: 'atmospheric' },
        { label: 'Materiales', value: 'materials' },
        { label: 'Dinero', value: 'money' },
        { label: 'Sepelio', value: 'funeral' },
        { label: 'Medicamento', value: 'medication' },
        { label: 'Préstamo ortopédico', value: 'orthopedic' },
      ],
      required: true,
      validate: (value: unknown) =>
        typeof value === 'string' && assistanceKinds.includes(value as (typeof assistanceKinds)[number])
          ? true
          : 'Tipo de asistencia no válido.',
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'quantity',
      type: 'number',
      min: 1,
      validate: (value: unknown, { siblingData }: { siblingData: { kind?: string } }) => {
        const kind = siblingData.kind
        if (kind && quantityKinds.has(kind)) {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return 'La cantidad es obligatoria.'
          return true
        }
        if (value !== undefined && value !== null) return 'Esta asistencia no lleva cantidad.'
        return true
      },
    },
    {
      name: 'amountPesos',
      type: 'number',
      min: 1,
      validate: (value: unknown, { siblingData }: { siblingData: { kind?: string } }) => {
        if (siblingData.kind === 'money') {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return 'El monto es obligatorio.'
          return true
        }
        if (value !== undefined && value !== null) return 'Esta asistencia no lleva monto.'
        return true
      },
    },
    {
      name: 'loanStatus',
      type: 'select',
      options: [
        { label: 'Prestado', value: 'loaned' },
        { label: 'Devuelto', value: 'returned' },
      ],
    },
    {
      name: 'returnedAt',
      type: 'date',
    },
  ],
  indexes: [{ fields: ['delivery'] }],
  timestamps: true,
}
