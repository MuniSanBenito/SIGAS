import type { CollectionConfig } from 'payload'

import { deliveryOperator } from '../access/roles'

export const DeliveryReports: CollectionConfig = {
  slug: 'delivery-reports',
  labels: {
    plural: 'Informes de entrega',
    singular: 'Informe de entrega',
  },
  upload: {
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
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
    },
  ],
}
