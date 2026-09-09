'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { IconAlertTriangle, IconArchive, IconHistory, IconPackages, IconPlus, IconRefresh, IconX } from '@tabler/icons-react'

import { CategoryForm } from './category-form'
import { MovementForm } from './movement-form'
import { ProductForm } from './product-form'
import { RecipeForm } from './recipe-form'
import type { InventoryOverview, InventoryProduct } from './inventory-ui-types'

type Category = { id: string; name: string }
type Dialog = 'category' | 'entry' | 'exit' | 'physicalCount' | 'product' | 'recipe' | null
type View = 'stock' | 'movements' | 'recipes'

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message ?? body?.errors?.[0]?.message ?? 'No se pudo completar la solicitud.')
  return body as T
}

function relationLabel(value: unknown, fallback: string): string {
  if (typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string') return value.name
  if (typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string') return value.code
  return fallback
}

export function InventoryWorkspace() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeView, setActiveView] = useState<View>('stock')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [deactivationTarget, setDeactivationTarget] = useState<InventoryProduct | null>(null)
  const [deactivationReason, setDeactivationReason] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function loadData() {
    setIsRefreshing(true)
    try {
      const [nextOverview, categoryResponse] = await Promise.all([
        getJSON<InventoryOverview>('/api/inventory/overview?includeInactive=true&limit=100'),
        getJSON<{ docs: Category[] }>('/api/product-categories?limit=100&sort=name'),
      ])
      setOverview(nextOverview)
      setCategories(categoryResponse.docs)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el inventario.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [])

  async function handleSaved(nextMessage: string) {
    setDialog(null)
    setMessage(nextMessage)
    await loadData()
  }

  async function deactivateProduct() {
    if (!deactivationTarget || !deactivationReason.trim()) return
    try {
      await getJSON(`/api/inventory/products/${deactivationTarget.id}/deactivate`, {
        body: JSON.stringify({ reason: deactivationReason.trim() }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      setDeactivationTarget(null)
      setDeactivationReason('')
      await handleSaved('Producto dado de baja correctamente.')
    } catch (deactivationError) {
      setError(deactivationError instanceof Error ? deactivationError.message : 'No se pudo dar de baja el producto.')
    }
  }

  const products = useMemo(() => overview?.data.products ?? [], [overview])
  const filteredProducts = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase())),
    [products, search],
  )

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Módulo operativo</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Inventario</h1><p className="mt-3 max-w-2xl text-base leading-7 text-content-muted">Controlá el depósito central con movimientos trazables, lotes y recetas versionadas.</p></div>
        <button aria-label="Actualizar inventario" className="btn btn-ghost self-start lg:self-auto" disabled={isRefreshing} onClick={() => void loadData()} type="button"><IconRefresh aria-hidden="true" className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />Actualizar</button>
      </div>

      {message && <p className="mt-6 rounded-box border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">{message}</p>}
      {error && <p className="mt-6 rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}

      <section aria-label="Resumen de inventario" className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Productos" value={overview?.data.summary.totalProducts ?? 0} />
        <SummaryCard label="Bajo mínimo" value={overview?.data.summary.lowStockProducts ?? 0} tone="warning" />
        <SummaryCard label="Vencen en 30 días" value={overview?.data.summary.expiringLots ?? 0} tone="error" />
      </section>

      <section className="mt-8 rounded-box border border-line bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="tabs tabs-boxed w-fit bg-surface-alt" role="tablist" aria-label="Vistas de inventario">
            <TabButton active={activeView === 'stock'} label="Stock actual" onClick={() => setActiveView('stock')} />
            <TabButton active={activeView === 'movements'} label="Movimientos" onClick={() => setActiveView('movements')} />
            <TabButton active={activeView === 'recipes'} label="Recetas" onClick={() => setActiveView('recipes')} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => setDialog('entry')} type="button"><IconPlus aria-hidden="true" className="h-4 w-4" />Cargar entrada</button>
            <button className="btn btn-outline" onClick={() => setDialog('exit')} type="button">Dar de baja</button>
            <button className="btn btn-outline" onClick={() => setDialog('physicalCount')} type="button">Conteo físico</button>
          </div>
        </div>

        {isLoading ? <div aria-busy="true" aria-label="Cargando inventario" className="mt-6 rounded-box border border-line bg-surface-alt p-8 text-center" role="status"><span className="loading loading-spinner loading-md text-primary" /><p className="mt-3 text-sm text-content-muted">Cargando productos y saldos…</p></div> : <>
          {activeView === 'stock' && <StockView filteredProducts={filteredProducts} onDeactivate={setDeactivationTarget} onNewCategory={() => setDialog('category')} onNewProduct={() => setDialog('product')} onSearch={setSearch} search={search} />}
          {activeView === 'movements' && <MovementView movements={overview?.data.recentMovements ?? []} />}
          {activeView === 'recipes' && <RecipeView onNewRecipe={() => setDialog('recipe')} />}
        </>}
      </section>

      {dialog && <DialogShell onClose={() => setDialog(null)}>{dialog === 'category' && <CategoryForm onCancel={() => setDialog(null)} onSaved={handleSaved} />}{dialog === 'product' && <ProductForm categories={categories} onCancel={() => setDialog(null)} onSaved={handleSaved} />}{dialog === 'entry' && <MovementForm mode="entry" onCancel={() => setDialog(null)} onSaved={handleSaved} products={products} />}{dialog === 'exit' && <MovementForm mode="exit" onCancel={() => setDialog(null)} onSaved={handleSaved} products={products} />}{dialog === 'physicalCount' && <MovementForm mode="physicalCount" onCancel={() => setDialog(null)} onSaved={handleSaved} products={products} />}{dialog === 'recipe' && <RecipeForm onCancel={() => setDialog(null)} onSaved={handleSaved} products={products} />}</DialogShell>}

      {deactivationTarget && <DialogShell onClose={() => setDeactivationTarget(null)}><div className="space-y-5"><div><h2 className="text-xl font-bold text-content">Dar de baja producto</h2><p className="mt-1 text-sm text-content-muted">{deactivationTarget.name} conservará su saldo e historial, pero no podrá recibir nuevas entradas ni formar parte de recetas.</p></div><label className="space-y-2"><span className="text-sm font-semibold text-content">Motivo obligatorio</span><textarea className="textarea textarea-bordered min-h-28 w-full bg-surface text-content" onChange={(event) => setDeactivationReason(event.target.value)} value={deactivationReason} /></label><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className="btn btn-ghost" onClick={() => setDeactivationTarget(null)} type="button">Cancelar</button><button className="btn btn-error" disabled={!deactivationReason.trim()} onClick={() => void deactivateProduct()} type="button">Confirmar baja</button></div></div></DialogShell>}
    </main>
  )
}

function SummaryCard({ label, tone = 'primary', value }: { label: string; tone?: 'error' | 'primary' | 'warning'; value: number }) {
  return <article className="rounded-box border border-line bg-surface-alt p-5"><div className={`text-3xl font-bold ${tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-primary'}`}>{value}</div><p className="mt-1 text-sm font-semibold text-content-muted">{label}</p></article>
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-selected={active} className={`tab min-h-11 text-sm font-semibold ${active ? 'tab-active' : ''}`} onClick={onClick} role="tab" type="button">{label}</button>
}

function StockView({ filteredProducts, onDeactivate, onNewCategory, onNewProduct, onSearch, search }: { filteredProducts: InventoryProduct[]; onDeactivate: (product: InventoryProduct) => void; onNewCategory: () => void; onNewProduct: () => void; onSearch: (value: string) => void; search: string }) {
  return <div className="mt-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex-1"><span className="sr-only">Buscar productos</span><input aria-label="Buscar productos" className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => onSearch(event.target.value)} placeholder="Buscar productos…" type="search" value={search} /></label><div className="flex gap-2"><button className="btn btn-outline" onClick={onNewCategory} type="button">Nueva categoría</button><button className="btn btn-outline" onClick={onNewProduct} type="button">Nuevo producto</button></div></div><div className="mt-5">{filteredProducts.length === 0 ? <div className="rounded-box border border-dashed border-line p-8 text-center" role="status"><IconPackages aria-hidden="true" className="mx-auto h-10 w-10 text-content-muted" /><h2 className="mt-3 font-bold text-content">No hay productos para mostrar</h2><p className="mt-1 text-sm text-content-muted">Creá el primer producto para comenzar a cargar stock.</p></div> : <div className="grid gap-4 md:grid-cols-2">{filteredProducts.map((product) => <ProductCard key={product.id} onDeactivate={onDeactivate} product={product} />)}</div>}</div></div>
}

function ProductCard({ onDeactivate, product }: { onDeactivate: (product: InventoryProduct) => void; product: InventoryProduct }) {
  return <article className="rounded-box border border-line bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-content">{product.name}</h2><p className="mt-1 text-sm text-content-muted">{relationLabel(product.category, 'Sin categoría')}</p></div><span className={`badge ${product.isActive ? 'badge-success' : 'badge-ghost'}`}>{product.isActive ? 'Activo' : 'Inactivo'}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Saldo</p><p className="mt-1 text-2xl font-bold text-content">{product.totalQuantity}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Mínimo</p><p className="mt-1 text-2xl font-bold text-content">{product.minimumStock}</p></div></div>{product.isLowStock && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-warning"><IconAlertTriangle aria-hidden="true" className="h-4 w-4" />Debajo del mínimo</p>}{product.lots.length > 0 && <p className="mt-3 text-sm text-content-muted">{product.lots.length} lote{product.lots.length === 1 ? '' : 's'} controlado{product.lots.length === 1 ? '' : 's'}</p>}{product.isActive && <button className="btn btn-ghost btn-sm mt-4" onClick={() => onDeactivate(product)} type="button"><IconArchive aria-hidden="true" className="h-4 w-4" />Dar de baja producto</button>}</article>
}

function MovementView({ movements }: { movements: InventoryOverview['data']['recentMovements'] }) {
  return <div className="mt-6">{movements.length === 0 ? <div className="rounded-box border border-dashed border-line p-8 text-center" role="status"><IconHistory aria-hidden="true" className="mx-auto h-10 w-10 text-content-muted" /><h2 className="mt-3 font-bold text-content">Todavía no hay movimientos</h2><p className="mt-1 text-sm text-content-muted">Las entradas, bajas y ajustes aparecerán acá.</p></div> : <div className="space-y-3">{movements.map((movement) => <article className="flex flex-col gap-3 rounded-box border border-line bg-surface-alt p-4 sm:flex-row sm:items-center sm:justify-between" key={movement.id}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${movement.movementType === 'entry' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}><IconPackages aria-hidden="true" className="h-5 w-5" /></span><div><p className="font-semibold text-content">{relationLabel(movement.product, 'Producto')} · {movement.reason}</p><p className="mt-1 text-sm text-content-muted">{movement.operationalDate} · {movement.movementType === 'entry' ? 'Entrada' : movement.movementType === 'exit' ? 'Salida' : 'Ajuste'}</p></div></div><p className="text-lg font-bold text-content">{movement.movementType === 'entry' || movement.movementType === 'adjustment' && movement.resultingQuantity >= movement.previousQuantity ? '+' : '-'}{movement.quantity}</p></article>)}</div>}</div>
}

function RecipeView({ onNewRecipe }: { onNewRecipe: () => void }) {
  return <div className="mt-6 rounded-box border border-dashed border-line bg-surface-alt p-8 text-center"><IconPackages aria-hidden="true" className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-3 text-lg font-bold text-content">Recetas versionadas</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-content-muted">Creá la composición de cada bolsón. Cada cambio conserva la versión anterior para mantener la trazabilidad.</p><button className="btn btn-primary mt-5" onClick={onNewRecipe} type="button"><IconPlus aria-hidden="true" className="h-4 w-4" />Nueva receta</button></div>
}

function DialogShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-neutral-950/60 px-4 py-8" role="presentation"><div aria-modal="true" className="mx-auto max-w-2xl rounded-box border border-line bg-surface p-5 shadow-2xl sm:p-7" role="dialog"><div className="mb-2 flex justify-end"><button aria-label="Cerrar diálogo" className="btn btn-square btn-ghost" onClick={onClose} type="button"><IconX aria-hidden="true" className="h-5 w-5" /></button></div>{children}</div></div>
}
