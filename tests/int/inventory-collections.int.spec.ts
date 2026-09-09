import { describe, expect, it } from 'vitest'

import { AuditLogs } from '@/collections/AuditLogs'
import { BundleVersions } from '@/collections/BundleVersions'
import { Bundles } from '@/collections/Bundles'
import { ProductCategories } from '@/collections/ProductCategories'
import { ProductLots } from '@/collections/ProductLots'
import { Products } from '@/collections/Products'
import { StockBalances } from '@/collections/StockBalances'
import { StockMovements } from '@/collections/StockMovements'

const accessArgs = (roles: string[]) => ({ req: { user: { roles } } })

const collections = [
  ProductCategories,
  Products,
  ProductLots,
  StockBalances,
  StockMovements,
  Bundles,
  BundleVersions,
  AuditLogs,
]

describe('inventory collection configuration', () => {
  it('registers the planned collection slugs', () => {
    expect(collections.map(({ slug }) => slug)).toEqual([
      'product-categories',
      'products',
      'product-lots',
      'stock-balances',
      'stock-movements',
      'bundles',
      'bundle-versions',
      'audit-logs',
    ])
  })

  it('allows stock and admin to read catalog and stock collections', () => {
    for (const collection of [ProductCategories, Products, ProductLots, StockBalances, StockMovements, Bundles, BundleVersions]) {
      expect(collection.access?.read?.(accessArgs(['stock']) as never)).toBe(true)
      expect(collection.access?.read?.(accessArgs(['admin']) as never)).toBe(true)
      expect(collection.access?.read?.(accessArgs(['administracion']) as never)).toBe(false)
    }
  })

  it('does not expose raw stock ledger mutations', () => {
    expect(StockBalances.access?.create?.(accessArgs(['admin']) as never)).toBe(false)
    expect(StockBalances.access?.update?.(accessArgs(['stock']) as never)).toBe(false)
    expect(StockBalances.access?.delete?.(accessArgs(['admin']) as never)).toBe(false)
    expect(StockMovements.access?.create?.(accessArgs(['stock']) as never)).toBe(false)
    expect(StockMovements.access?.update?.(accessArgs(['admin']) as never)).toBe(false)
    expect(StockMovements.access?.delete?.(accessArgs(['admin']) as never)).toBe(false)
  })

  it('restricts audit logs to administrators', () => {
    expect(AuditLogs.access?.read?.(accessArgs(['admin']) as never)).toBe(true)
    expect(AuditLogs.access?.read?.(accessArgs(['stock']) as never)).toBe(false)
    expect(AuditLogs.access?.create?.(accessArgs(['admin']) as never)).toBe(false)
    expect(AuditLogs.access?.delete?.(accessArgs(['admin']) as never)).toBe(false)
  })
})
