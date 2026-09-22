import type { Endpoint } from 'payload'

import { canAccessModule } from '../access/roles'
import type { Product, ProductCategory, ProductLot, StockBalance, StockMovement, User } from '../payload-types'
import {
  createCategory,
  createProduct,
  deactivateProduct,
  reactivateProduct,
  updateCategory,
  updateProduct,
} from '../inventory/catalog-service'
import {
  parseCreateCategoryInput,
  parseCreateProductInput,
  parseRequiredReason,
  parseUpdateCategoryInput,
  parseUpdateProductInput,
} from '../inventory/catalog-validation'
import { InventoryError, inventoryErrorResponse } from '../inventory/errors'
import { createRecipe, listRecipes, projectRecipe } from '../inventory/recipe-service'
import { parseRecipeCommand } from '../inventory/recipe-validation'
import { parseStockBatchCommand } from '../inventory/batch-validation'
import { inventoryErrorMessage } from '../inventory/labels'
import { correctStockMovement, recordStockMovement, type InventoryRequest } from '../inventory/stock-service'
import { parseStockCommand } from '../inventory/validation'

function authenticatedInventoryUser(req: InventoryRequest): User {
  if (!req.user) throw new InventoryError('UNAUTHENTICATED', 'Authentication is required', 401)
  if (!canAccessModule(req.user, 'inventory')) {
    throw new InventoryError('FORBIDDEN', 'You do not have inventory access', 403)
  }
  return req.user
}

async function requestBody(req: InventoryRequest): Promise<unknown> {
  if (typeof req.json === 'function') return req.json()
  return req.data
}

function requestUrl(req: InventoryRequest): URL {
  if (!req.url) throw new InventoryError('INTERNAL_ERROR', 'Request URL is unavailable', 500)
  return new URL(req.url)
}

function relationId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') return value.id
  throw new InventoryError('INTERNAL_ERROR', 'Invalid relationship returned by inventory data', 500)
}

function mapMovement(movement: StockMovement) {
  return {
    correctionOf: movement.correctionOf
      ? typeof movement.correctionOf === 'string'
        ? movement.correctionOf
        : movement.correctionOf.id
      : null,
    createdAt: movement.createdAt,
    createdBy: movement.createdBy,
    id: movement.id,
    lot: movement.lot,
    movementType: movement.movementType,
    operationalDate: movement.operationalDate,
    previousQuantity: movement.previousQuantity,
    product: movement.product,
    quantity: movement.quantity,
    reason: movement.reason,
    referenceId: movement.referenceId ?? null,
    referenceType: movement.referenceType ?? null,
    resultingQuantity: movement.resultingQuantity,
    status: movement.status,
  }
}

async function stockMovementBatchEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const command = parseStockBatchCommand(await requestBody(req))
    const results = []

    for (const line of command.lines) {
      try {
        const result = await recordStockMovement(req, {
          movement: line.movement,
          operationKey: `${command.batchOperationKey}:${line.lineKey}`,
        })
        results.push({
          lineKey: line.lineKey,
          ok: true,
          previousQuantity: result.previousQuantity,
          resultingQuantity: result.resultingQuantity,
          replayed: result.replayed,
        })
      } catch (error) {
        const message =
          error instanceof InventoryError
            ? inventoryErrorMessage(error.message)
            : 'No se pudo completar. Probá de nuevo.'
        results.push({
          code: error instanceof InventoryError ? error.code : 'INTERNAL_ERROR',
          lineKey: line.lineKey,
          message,
          ok: false,
        })
      }
    }

    const succeeded = results.filter((result) => result.ok).length
    const failed = results.length - succeeded

    return Response.json({
      data: {
        failed,
        results,
        succeeded,
      },
      meta: {
        batchOperationKey: command.batchOperationKey,
        total: results.length,
      },
    })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function stockMovementEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const command = parseStockCommand(await requestBody(req))
    const result = await recordStockMovement(req, command)
    return Response.json({
      data: {
        balance: result.balance,
        movement: result.movement,
        previousQuantity: result.previousQuantity,
        resultingQuantity: result.resultingQuantity,
      },
      meta: { replayed: result.replayed },
    })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function correctMovementEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const movementId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!movementId) throw new InventoryError('VALIDATION_ERROR', 'Movement id is required', 422)
    const body = await requestBody(req)
    const reason = parseRequiredReason(typeof body === 'object' && body !== null && 'reason' in body ? body.reason : undefined)
    const result = await correctStockMovement(req, movementId, reason)
    return Response.json({
      data: {
        balance: result.balance,
        correctedMovement: result.correctedMovement,
        correctionMovement: result.correctionMovement,
        previousQuantity: result.previousQuantity,
        resultingQuantity: result.resultingQuantity,
      },
      meta: { replayed: result.replayed },
    })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function inventoryOverviewEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    const user = authenticatedInventoryUser(req)
    const url = requestUrl(req)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
    const movementLimit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('movementLimit') ?? '50', 10) || 50))
    const includeInactive = url.searchParams.get('includeInactive') === 'true'

    const [productsResult, balancesResult, lotsResult, movementsResult, categoriesResult, movementProductsResult] = await Promise.all([
      req.payload.find({
        collection: 'products',
        depth: 1,
        limit: 1000,
        overrideAccess: false,
        req,
        user,
        sort: 'name',
      }),
      req.payload.find({
        collection: 'stock-balances',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        req,
        user,
      }),
      req.payload.find({
        collection: 'product-lots',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        req,
        user,
      }),
      req.payload.find({
        collection: 'stock-movements',
        depth: 1,
        limit: movementLimit,
        overrideAccess: false,
        req,
        sort: '-createdAt',
        user,
      }),
      req.payload.find({
        collection: 'product-categories',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        req,
        sort: 'name',
        user,
      }),
      req.payload.find({
        collection: 'stock-movements',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        req,
        select: { product: true },
        user,
      }),
    ])

    const products = productsResult.docs as Product[]
    const balances = balancesResult.docs as StockBalance[]
    const lots = lotsResult.docs as ProductLot[]
    const categories = categoriesResult.docs as ProductCategory[]
    const productsWithMovements = new Set(
      (movementProductsResult.docs as StockMovement[]).map((movement) => relationId(movement.product)),
    )
    const today = new Date()
    const todayKey = today.toISOString().slice(0, 10)
    const warningLimitKey = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const rows = products
      .map((product) => {
        const productBalances = balances.filter((balance) => relationId(balance.product) === product.id)
        const productLots = lots
          .filter((lot) => relationId(lot.product) === product.id)
          .map((lot) => {
            const balance = productBalances.find((item) => relationId(item.lot) === lot.id)
            const expirationKey = lot.expirationDate.slice(0, 10)
            return {
              code: lot.code,
              expirationDate: lot.expirationDate,
              id: lot.id,
              isExpired: expirationKey < todayKey,
              isExpiringSoon: expirationKey >= todayKey && expirationKey <= warningLimitKey,
              quantity: balance?.quantity ?? 0,
            }
          })
        const totalQuantity = productBalances.reduce((total, balance) => total + balance.quantity, 0)

        return {
          category: typeof product.category === 'object' ? product.category : product.category,
          hasMovements: productsWithMovements.has(product.id),
          id: product.id,
          isActive: product.isActive,
          isLowStock: totalQuantity < product.minimumStock,
          lots: productLots,
          minimumStock: product.minimumStock,
          name: product.name,
          totalQuantity,
          tracksLotExpiration: product.tracksLotExpiration,
        }
      })
      .filter((product) => includeInactive || product.isActive || product.totalQuantity > 0)

    const paginatedProducts = rows.slice((page - 1) * limit, page * limit)
    const lowStockProducts = rows.filter((product) => product.isLowStock).length
    const expiringLots = rows.reduce(
      (total, product) => total + product.lots.filter((lot) => lot.isExpiringSoon).length,
      0,
    )

    return Response.json({
      data: {
        categories: categories.map((category) => ({
          id: category.id,
          isActive: category.isActive,
          name: category.name,
        })),
        products: paginatedProducts,
        recentMovements: (movementsResult.docs as StockMovement[]).map(mapMovement),
        summary: {
          expiringLots,
          lowStockProducts,
          totalProducts: rows.length,
        },
      },
      pagination: {
        limit,
        page,
        totalItems: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      },
    })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function createProductEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const product = await createProduct(req, parseCreateProductInput(await requestBody(req)))
    return Response.json({ data: product }, { status: 201 })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function updateProductEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const productId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!productId) throw new InventoryError('VALIDATION_ERROR', 'Product id is required', 422)
    const product = await updateProduct(req, productId, parseUpdateProductInput(await requestBody(req)))
    return Response.json({ data: product })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function deactivateProductEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const productId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!productId) throw new InventoryError('VALIDATION_ERROR', 'Product id is required', 422)
    const body = await requestBody(req)
    const reason = parseRequiredReason(typeof body === 'object' && body !== null && 'reason' in body ? body.reason : undefined)
    const product = await deactivateProduct(req, productId, reason)
    return Response.json({ data: product })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function reactivateProductEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const productId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!productId) throw new InventoryError('VALIDATION_ERROR', 'Product id is required', 422)
    const product = await reactivateProduct(req, productId)
    return Response.json({ data: product })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function createCategoryEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const category = await createCategory(req, parseCreateCategoryInput(await requestBody(req)))
    return Response.json({ data: category }, { status: 201 })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function updateCategoryEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const categoryId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!categoryId) throw new InventoryError('VALIDATION_ERROR', 'Category id is required', 422)
    const category = await updateCategory(req, categoryId, parseUpdateCategoryInput(await requestBody(req)))
    return Response.json({ data: category })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function recipeListEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    return Response.json({ data: await listRecipes(req) })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function recipeEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const recipe = await createRecipe(req, parseRecipeCommand(await requestBody(req)))
    return Response.json({ data: recipe }, { status: 201 })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

async function recipeProjectionEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    authenticatedInventoryUser(req)
    const versionId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!versionId) throw new InventoryError('VALIDATION_ERROR', 'Bundle version id is required', 422)
    return Response.json({ data: await projectRecipe(req, versionId) })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}

export const inventoryEndpoints: Endpoint[] = [
  {
    handler: (req) => inventoryOverviewEndpoint(req as InventoryRequest),
    method: 'get',
    path: '/inventory/overview',
  },
  {
    handler: (req) => stockMovementEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/movements',
  },
  {
    handler: (req) => stockMovementBatchEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/movements/batch',
  },
  {
    handler: (req) => correctMovementEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/movements/:id/correct',
  },
  {
    handler: (req) => createProductEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/products',
  },
  {
    handler: (req) => updateProductEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/products/:id',
  },
  {
    handler: (req) => deactivateProductEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/products/:id/deactivate',
  },
  {
    handler: (req) => reactivateProductEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/products/:id/reactivate',
  },
  {
    handler: (req) => createCategoryEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/categories',
  },
  {
    handler: (req) => updateCategoryEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/categories/:id',
  },
  {
    handler: (req) => recipeListEndpoint(req as InventoryRequest),
    method: 'get',
    path: '/inventory/recipes',
  },
  {
    handler: (req) => recipeEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/recipes',
  },
  {
    handler: (req) => recipeProjectionEndpoint(req as InventoryRequest),
    method: 'get',
    path: '/inventory/recipes/:id/projection',
  },
]
