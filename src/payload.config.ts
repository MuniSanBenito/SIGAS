import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { AuditLogs } from './collections/AuditLogs'
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
  endpoints: inventoryEndpoints,
  sharp,
  plugins: [],
})
