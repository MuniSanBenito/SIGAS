import type { Endpoint } from 'payload'

import { canAccessModule } from '../access/roles'
import type { Product, ProductLot, StockBalance, StockMovement, User } from '../payload-types'
import { InventoryError, inventoryErrorResponse } from '../inventory/errors'
import { createRecipe, projectRecipe } from '../inventory/recipe-service'
import { parseRecipeCommand } from '../inventory/recipe-validation'
import { auditInventoryAction, recordStockMovement, type InventoryRequest } from '../inventory/stock-service'
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

function requiredReason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InventoryError('VALIDATION_ERROR', 'A reason is required', 422)
  }
  if (value.trim().length > 500) {
    throw new InventoryError('VALIDATION_ERROR', 'The reason is too long', 422)
  }
  return value.trim()
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

async function inventoryOverviewEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    const user = authenticatedInventoryUser(req)
    const url = requestUrl(req)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
    const includeInactive = url.searchParams.get('includeInactive') === 'true'

    const [productsResult, balancesResult, lotsResult, movementsResult] = await Promise.all([
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
        limit: 10,
        overrideAccess: false,
        req,
        sort: '-createdAt',
        user,
      }),
    ])

    const products = productsResult.docs as Product[]
    const balances = balancesResult.docs as StockBalance[]
    const lots = lotsResult.docs as ProductLot[]
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
        products: paginatedProducts,
        recentMovements: movementsResult.docs as StockMovement[],
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

async function deactivateProductEndpoint(req: InventoryRequest): Promise<Response> {
  try {
    const user = authenticatedInventoryUser(req)
    const productId = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    if (!productId) throw new InventoryError('VALIDATION_ERROR', 'Product id is required', 422)
    const body = await requestBody(req)
    const reasonValue = typeof body === 'object' && body !== null && 'reason' in body ? body.reason : undefined
    const reason = requiredReason(reasonValue)
    const product = (await req.payload.findByID({
      collection: 'products',
      depth: 0,
      id: productId,
      overrideAccess: false,
      req,
      user,
    })) as Product

    if (!product.isActive) {
      throw new InventoryError('CONFLICT', 'Product is already inactive', 409)
    }

    const updated = (await req.payload.update({
      collection: 'products',
      data: { inactiveReason: reason, isActive: false },
      id: productId,
      overrideAccess: false,
      req,
      user,
    })) as Product

    await auditInventoryAction(req, user, {
      action: 'product.deactivated',
      after: { isActive: updated.isActive, inactiveReason: reason },
      before: { isActive: product.isActive, inactiveReason: product.inactiveReason ?? null },
      reason,
      result: 'success',
      targetId: productId,
      targetType: 'product',
    })

    return Response.json({ data: updated })
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
    handler: (req) => deactivateProductEndpoint(req as InventoryRequest),
    method: 'post',
    path: '/inventory/products/:id/deactivate',
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
