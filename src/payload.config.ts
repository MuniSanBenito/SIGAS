import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { es } from 'payload/i18n/es'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { AuditLogs } from './collections/AuditLogs'
import { Deliveries } from './collections/Deliveries'
import { DeliveryBundles } from './collections/DeliveryBundles'
import { DeliveryLines } from './collections/DeliveryLines'
import { FamilyGroups } from './collections/FamilyGroups'
import { GroupMembers } from './collections/GroupMembers'
import { KinshipRelations } from './collections/KinshipRelations'
import { contribuyenteEndpoints } from './endpoints/contribuyentes'
import { deliveryEndpoints } from './endpoints/entregas'
import { groupEndpoints } from './endpoints/grupos'
import { inventoryEndpoints } from './endpoints/inventory'
import { BundleVersions } from './collections/BundleVersions'
import { Bundles } from './collections/Bundles'
import { Media } from './collections/Media'
import { ProductCategories } from './collections/ProductCategories'
import { ProductLots } from './collections/ProductLots'
import { Products } from './collections/Products'
import { StockBalances } from './collections/StockBalances'
import { StockMovements } from './collections/StockMovements'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '· SIGAS',
    },
  },
  i18n: {
    fallbackLanguage: 'es',
    supportedLanguages: { es },
  },
  collections: [
    Users,
    Media,
    ProductCategories,
    Products,
    ProductLots,
    StockBalances,
    StockMovements,
    Bundles,
    BundleVersions,
    KinshipRelations,
    FamilyGroups,
    GroupMembers,
    Deliveries,
    DeliveryBundles,
    DeliveryLines,
    AuditLogs,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
  }),
  endpoints: [...inventoryEndpoints, ...contribuyenteEndpoints, ...groupEndpoints, ...deliveryEndpoints],
  sharp,
  plugins: [],
})
