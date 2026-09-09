export type InventoryLot = {
  code: string
  expirationDate: string
  id: string
  isExpired: boolean
  isExpiringSoon: boolean
  quantity: number
}

export type InventoryProduct = {
  category: { id: string; name: string } | string
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
  resultingQuantity: number
}

export type InventoryOverview = {
  data: {
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
