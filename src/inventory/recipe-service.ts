import type { PayloadRequest } from 'payload'

import type { Bundle, BundleVersion, Product, ProductLot, StockBalance, User } from '../payload-types'
import { InventoryError } from './errors'
import { auditInventoryAction, type InventoryRequest } from './stock-service'
import type { RecipeCommandInput } from './recipe-validation'

export type RecipeProjection = {
  bundleVersionId: string
  capacity: number
  limitingProduct?: { id: string; name: string; availableQuantity: number; requiredQuantity: number }
}

export type RecipeLineSummary = {
  productId: string
  productName: string
  quantity: number
}

export type RecipeSummary = {
  bundleDescription?: string | null
  bundleId: string
  bundleName: string
  capacity: number
  currentVersion?: {
    effectiveFrom: string
    id: string
    lines: RecipeLineSummary[]
    version: number
  }
  isActive: boolean
  limitingProduct?: RecipeProjection['limitingProduct']
}

function relationId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') return value.id
  throw new InventoryError('INTERNAL_ERROR', 'Invalid relationship returned by recipe data', 500)
}

async function findProduct(req: InventoryRequest, id: string): Promise<Product> {
  try {
    return (await req.payload.findByID({
      collection: 'products',
      depth: 0,
      id,
      overrideAccess: true,
      req,
    })) as Product
  } catch {
    throw new InventoryError('NOT_FOUND', 'Recipe product not found', 404)
  }
}

async function findBundle(req: InventoryRequest, id: string): Promise<Bundle> {
  try {
    return (await req.payload.findByID({
      collection: 'bundles',
      depth: 0,
      id,
      overrideAccess: false,
      req,
      user: req.user,
    })) as Bundle
  } catch {
    throw new InventoryError('NOT_FOUND', 'Bundle not found', 404)
  }
}

export async function createRecipe(req: InventoryRequest, input: RecipeCommandInput): Promise<BundleVersion> {
  const bundle = input.bundleId
    ? await findBundle(req, input.bundleId)
    : ((await req.payload.create({
        collection: 'bundles',
        data: {
          description: input.description,
          isActive: true,
          name: input.bundleName as string,
        },
        overrideAccess: false,
        req,
        user: req.user,
      })) as Bundle)

  if (!bundle.isActive) {
    throw new InventoryError('CONFLICT', 'Inactive bundles cannot receive new versions', 409)
  }

  if (input.bundleId && input.bundleName && input.bundleName !== bundle.name) {
    await req.payload.update({
      collection: 'bundles',
      data: { name: input.bundleName },
      id: bundle.id,
      overrideAccess: false,
      req,
      user: req.user,
    })
  }

  const products = await Promise.all(input.lines.map((line) => findProduct(req, line.productId)))
  const inactiveProduct = products.find((product) => !product.isActive)
  if (inactiveProduct) {
    throw new InventoryError('CONFLICT', 'Inactive products cannot be added to a recipe', 409)
  }

  const versions = await req.payload.find({
    collection: 'bundle-versions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    sort: '-version',
    where: { bundle: { equals: bundle.id } },
  })
  const previousVersion = versions.docs[0] as BundleVersion | undefined
  if (previousVersion) {
    await req.payload.update({
      collection: 'bundle-versions',
      data: { effectiveTo: input.effectiveFrom, status: 'historical' },
      id: previousVersion.id,
      overrideAccess: true,
      req,
    })
  }

  const version = (await req.payload.create({
    collection: 'bundle-versions',
    data: {
      bundle: bundle.id,
      createdBy: req.user.id,
      effectiveFrom: input.effectiveFrom,
      lines: input.lines.map((line) => ({ product: line.productId, quantity: line.quantity })),
      status: 'current',
      version: (previousVersion?.version ?? 0) + 1,
    },
    draft: false,
    overrideAccess: true,
    req,
  })) as BundleVersion

  await auditInventoryAction(req, req.user, {
    action: 'recipe.version_created',
    after: { bundleId: bundle.id, versionId: version.id, version: version.version },
    context: { lineCount: input.lines.length },
    result: 'success',
    targetId: version.id,
    targetType: 'bundle-version',
  })

  return version
}

async function availableQuantity(req: InventoryRequest, product: Product, balances: StockBalance[], lots: ProductLot[]): Promise<number> {
  const productBalances = balances.filter((balance) => relationId(balance.product) === product.id)
  if (!product.tracksLotExpiration) return productBalances.reduce((total, balance) => total + balance.quantity, 0)

  const todayKey = new Date().toISOString().slice(0, 10)
  const validLots = new Set(
    lots
      .filter((lot) => relationId(lot.product) === product.id && lot.expirationDate.slice(0, 10) >= todayKey)
      .map((lot) => lot.id),
  )
  return productBalances.reduce((total, balance) => {
    const lotId = balance.lot ? relationId(balance.lot) : undefined
    return lotId && validLots.has(lotId) ? total + balance.quantity : total
  }, 0)
}

export async function projectRecipe(req: InventoryRequest, versionId: string): Promise<RecipeProjection> {
  const version = (await req.payload.findByID({
    collection: 'bundle-versions',
    depth: 0,
    id: versionId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as BundleVersion

  const [balancesResult, lotsResult] = await Promise.all([
    req.payload.find({ collection: 'stock-balances', depth: 0, limit: 1000, overrideAccess: true, req }),
    req.payload.find({ collection: 'product-lots', depth: 0, limit: 1000, overrideAccess: true, req }),
  ])
  const balances = balancesResult.docs as StockBalance[]
  const lots = lotsResult.docs as ProductLot[]
  const capacities = await Promise.all(
    version.lines.map(async (line) => {
      const product = await findProduct(req, relationId(line.product))
      const available = await availableQuantity(req, product, balances, lots)
      return {
        available,
        product,
        required: line.quantity,
        capacity: Math.floor(available / line.quantity),
      }
    }),
  )
  const limiting = capacities.reduce((current, candidate) =>
    candidate.capacity < current.capacity ? candidate : current,
  )
  const capacity = Math.min(...capacities.map((item) => item.capacity))

  return {
    bundleVersionId: version.id,
    capacity,
    limitingProduct: {
      availableQuantity: limiting.available,
      id: limiting.product.id,
      name: limiting.product.name,
      requiredQuantity: limiting.required,
    },
  }
}

export async function listRecipes(req: InventoryRequest): Promise<RecipeSummary[]> {
  const bundlesResult = await req.payload.find({
    collection: 'bundles',
    depth: 0,
    limit: 1000,
    overrideAccess: false,
    req,
    sort: 'name',
    user: req.user,
  })
  const bundles = bundlesResult.docs as Bundle[]

  return Promise.all(
    bundles.map(async (bundle) => {
      const versions = await req.payload.find({
        collection: 'bundle-versions',
        depth: 1,
        limit: 1,
        overrideAccess: false,
        req,
        sort: '-version',
        user: req.user,
        where: {
          and: [{ bundle: { equals: bundle.id } }, { status: { equals: 'current' } }],
        },
      })
      const currentVersion = versions.docs[0] as BundleVersion | undefined
      let projection: RecipeProjection | undefined
      let lines: RecipeLineSummary[] = []

      if (currentVersion) {
        projection = await projectRecipe(req, currentVersion.id)
        lines = await Promise.all(
          currentVersion.lines.map(async (line) => {
            const product = await findProduct(req, relationId(line.product))
            return {
              productId: product.id,
              productName: product.name,
              quantity: line.quantity,
            }
          }),
        )
      }

      return {
        bundleDescription: bundle.description,
        bundleId: bundle.id,
        bundleName: bundle.name,
        capacity: projection?.capacity ?? 0,
        currentVersion: currentVersion
          ? {
              effectiveFrom: currentVersion.effectiveFrom,
              id: currentVersion.id,
              lines,
              version: currentVersion.version,
            }
          : undefined,
        isActive: bundle.isActive,
        limitingProduct: projection?.limitingProduct,
      }
    }),
  )
}

export type RecipeRequest = PayloadRequest & { user: User }
