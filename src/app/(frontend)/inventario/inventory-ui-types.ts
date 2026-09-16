export type InventoryLot = {
  code: string
  expirationDate: string
  id: string
  isExpired: boolean
  isExpiringSoon: boolean
  quantity: number
}

export type InventoryCategory = {
  id: string
  isActive: boolean
  name: string
}

export type InventoryProduct = {
  category: { id: string; name: string } | string
  hasMovements: boolean
  id: string
  isActive: boolean
  isLowStock: boolean
  lots: InventoryLot[]
  minimumStock: number
  name: string
  totalQuantity: number
  tracksLotExpiration: boolean
}

export type InventoryMovement = {
  correctionOf: string | null
  createdAt: string
  createdBy: string | { id: string; username?: string }
  id: string
  lot?: string | { id: string; code?: string } | null
  movementType: 'entry' | 'exit' | 'adjustment'
  operationalDate: string
  previousQuantity: number
  product: string | { id: string; name?: string }
  quantity: number
  reason: string
  referenceId: string | null
  referenceType: string | null
  resultingQuantity: number
  status: 'active' | 'corrected'
}

export type InventoryOverview = {
  data: {
    categories: InventoryCategory[]
    products: InventoryProduct[]
    recentMovements: InventoryMovement[]
    summary: {
      expiringLots: number
      lowStockProducts: number
      totalProducts: number
    }
  }
  pagination: {
    limit: number
    page: number
    totalItems: number
    totalPages: number
  }
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
  limitingProduct?: {
    availableQuantity: number
    id: string
    name: string
    requiredQuantity: number
  }
}
