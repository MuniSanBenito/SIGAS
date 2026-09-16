import type { Product, ProductCategory } from '../payload-types'
import { InventoryError } from './errors'
import type {
  CreateCategoryInput,
  CreateProductInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from './catalog-validation'
import { auditInventoryAction, type InventoryRequest } from './stock-service'

async function findProduct(req: InventoryRequest, productId: string): Promise<Product> {
  try {
    return (await req.payload.findByID({
      collection: 'products',
      depth: 0,
      id: productId,
      overrideAccess: false,
      req,
      user: req.user,
    })) as Product
  } catch {
    throw new InventoryError('NOT_FOUND', 'Product not found', 404)
  }
}

async function findCategory(req: InventoryRequest, categoryId: string): Promise<ProductCategory> {
  try {
    return (await req.payload.findByID({
      collection: 'product-categories',
      depth: 0,
      id: categoryId,
      overrideAccess: false,
      req,
      user: req.user,
    })) as ProductCategory
  } catch {
    throw new InventoryError('NOT_FOUND', 'Category not found', 404)
  }
}

function productSnapshot(product: Product) {
  return {
    category: typeof product.category === 'string' ? product.category : product.category?.id ?? null,
    inactiveReason: product.inactiveReason ?? null,
    isActive: product.isActive,
    minimumStock: product.minimumStock,
    name: product.name,
    tracksLotExpiration: product.tracksLotExpiration,
  }
}

function categorySnapshot(category: ProductCategory) {
  return {
    isActive: category.isActive,
    name: category.name,
  }
}

export async function createProduct(req: InventoryRequest, input: CreateProductInput): Promise<Product> {
  await findCategory(req, input.categoryId)

  const product = (await req.payload.create({
    collection: 'products',
    data: {
      category: input.categoryId,
      isActive: true,
      minimumStock: input.minimumStock,
      name: input.name,
      tracksLotExpiration: input.tracksLotExpiration,
    },
    overrideAccess: false,
    req,
    user: req.user,
  })) as Product

  await auditInventoryAction(req, req.user, {
    action: 'product.created',
    after: productSnapshot(product),
    result: 'success',
    targetId: product.id,
    targetType: 'product',
  })

  return product
}

export async function updateProduct(
  req: InventoryRequest,
  productId: string,
  input: UpdateProductInput,
): Promise<Product> {
  const product = await findProduct(req, productId)
  const data: Partial<Product> = {}

  if (input.name !== undefined) data.name = input.name
  if (input.minimumStock !== undefined) data.minimumStock = input.minimumStock
  if (input.categoryId !== undefined) {
    await findCategory(req, input.categoryId)
    data.category = input.categoryId
  }
  if (input.tracksLotExpiration !== undefined) data.tracksLotExpiration = input.tracksLotExpiration

  const updated = (await req.payload.update({
    collection: 'products',
    data,
    id: productId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as Product

  await auditInventoryAction(req, req.user, {
    action: 'product.updated',
    after: productSnapshot(updated),
    before: productSnapshot(product),
    result: 'success',
    targetId: productId,
    targetType: 'product',
  })

  return updated
}

export async function deactivateProduct(req: InventoryRequest, productId: string, reason: string): Promise<Product> {
  const product = await findProduct(req, productId)

  if (!product.isActive) {
    throw new InventoryError('CONFLICT', 'Product is already inactive', 409)
  }

  const updated = (await req.payload.update({
    collection: 'products',
    data: { inactiveReason: reason, isActive: false },
    id: productId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as Product

  await auditInventoryAction(req, req.user, {
    action: 'product.deactivated',
    after: productSnapshot(updated),
    before: productSnapshot(product),
    reason,
    result: 'success',
    targetId: productId,
    targetType: 'product',
  })

  return updated
}

export async function reactivateProduct(req: InventoryRequest, productId: string): Promise<Product> {
  const product = await findProduct(req, productId)

  if (product.isActive) {
    throw new InventoryError('CONFLICT', 'Product is already active', 409)
  }

  const updated = (await req.payload.update({
    collection: 'products',
    data: { inactiveReason: null, isActive: true },
    id: productId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as Product

  await auditInventoryAction(req, req.user, {
    action: 'product.reactivated',
    after: productSnapshot(updated),
    before: productSnapshot(product),
    result: 'success',
    targetId: productId,
    targetType: 'product',
  })

  return updated
}

export async function createCategory(req: InventoryRequest, input: CreateCategoryInput): Promise<ProductCategory> {
  const category = (await req.payload.create({
    collection: 'product-categories',
    data: { isActive: true, name: input.name },
    overrideAccess: false,
    req,
    user: req.user,
  })) as ProductCategory

  await auditInventoryAction(req, req.user, {
    action: 'category.created',
    after: categorySnapshot(category),
    result: 'success',
    targetId: category.id,
    targetType: 'product-category',
  })

  return category
}

export async function updateCategory(
  req: InventoryRequest,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<ProductCategory> {
  const category = await findCategory(req, categoryId)
  const data: Partial<ProductCategory> = {}

  if (input.name !== undefined) data.name = input.name
  if (input.isActive !== undefined) data.isActive = input.isActive

  const updated = (await req.payload.update({
    collection: 'product-categories',
    data,
    id: categoryId,
    overrideAccess: false,
    req,
    user: req.user,
  })) as ProductCategory

  await auditInventoryAction(req, req.user, {
    action: 'category.updated',
    after: categorySnapshot(updated),
    before: categorySnapshot(category),
    result: 'success',
    targetId: categoryId,
    targetType: 'product-category',
  })

  return updated
}
