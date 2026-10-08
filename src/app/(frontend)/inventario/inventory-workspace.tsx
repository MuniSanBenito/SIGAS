'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconArchive,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconHistory,
  IconPackages,
  IconPlus,
} from '@tabler/icons-react'

import {
  movementReasonLabel,
  movementTypeLabel,
  PRODUCT_ACTIVE_LABELS,
} from '@/inventory/labels'

import { AppDialog, AppDialogBody, AppDialogFooter } from '../app-dialog'
import { CategoryForm } from './category-form'
import { LoadForm, type LoadIntent } from './load-form'
import { ProductForm } from './product-form'
import { RecipeForm } from './recipe-form'
import type {
  InventoryCategory,
  InventoryMovement,
  InventoryOverview,
  InventoryProduct,
  RecipeSummary,
} from './inventory-ui-types'

type Dialog = 'category' | 'load' | 'product' | 'recipe' | null
type View = 'stock' | 'movements' | 'bolsones' | 'catalog'
type StockFilter = 'all' | 'expiring' | 'low'

const INVENTORY_PAGE_SIZE = 10

function getInventoryPageSlice<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / INVENTORY_PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * INVENTORY_PAGE_SIZE
  return { items: items.slice(start, start + INVENTORY_PAGE_SIZE), safePage, totalPages }
}

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

function canCorrectMovement(movement: InventoryMovement): boolean {
  return movement.status === 'active' && !movement.correctionOf && movement.referenceType !== 'delivery'
}

export function InventoryWorkspace() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [activeView, setActiveView] = useState<View>('stock')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [loadIntent, setLoadIntent] = useState<LoadIntent>('physicalCount')
  const [loadProductId, setLoadProductId] = useState<string | undefined>()
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<RecipeSummary | null>(null)
  const [deactivationTarget, setDeactivationTarget] = useState<InventoryProduct | null>(null)
  const [deactivationReason, setDeactivationReason] = useState('')
  const [correctionTarget, setCorrectionTarget] = useState<InventoryMovement | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [listPage, setListPage] = useState(1)

  async function loadData() {
    try {
      const [nextOverview, recipeResponse] = await Promise.all([
        getJSON<InventoryOverview>('/api/inventory/overview?includeInactive=true&limit=200&movementLimit=50'),
        getJSON<{ data: RecipeSummary[] }>('/api/inventory/recipes'),
      ])
      setOverview(nextOverview)
      setRecipes(recipeResponse.data)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el inventario.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [])

  useEffect(() => {
    setListPage(1)
  }, [activeView, search, stockFilter])

  function closeDialog() {
    setDialog(null)
    setEditingProduct(null)
    setEditingCategory(null)
    setEditingRecipe(null)
    setLoadProductId(undefined)
  }

  function openLoad(intent: LoadIntent = 'physicalCount', productId?: string) {
    setLoadIntent(intent)
    setLoadProductId(productId)
    setDialog('load')
  }

  async function handleSaved(nextMessage: string) {
    closeDialog()
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
      await handleSaved('El producto dejó de usarse correctamente.')
    } catch (deactivationError) {
      setError(deactivationError instanceof Error ? deactivationError.message : 'No se pudo dejar de usar el producto.')
    }
  }

  async function reactivateProduct(product: InventoryProduct) {
    try {
      await getJSON(`/api/inventory/products/${product.id}/reactivate`, { method: 'POST' })
      await handleSaved('El producto volvió a usarse correctamente.')
    } catch (reactivationError) {
      setError(reactivationError instanceof Error ? reactivationError.message : 'No se pudo volver a usar el producto.')
    }
  }

  async function correctMovement() {
    if (!correctionTarget || !correctionReason.trim()) return
    try {
      await getJSON(`/api/inventory/movements/${correctionTarget.id}/correct`, {
        body: JSON.stringify({ reason: correctionReason.trim() }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      setCorrectionTarget(null)
      setCorrectionReason('')
      await handleSaved('Movimiento deshecho correctamente.')
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : 'No se pudo deshacer el movimiento.')
    }
  }

  const categories = useMemo(() => overview?.data.categories ?? [], [overview])
  const products = useMemo(() => overview?.data.products ?? [], [overview])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      if (query && !product.name.toLowerCase().includes(query)) return false
      if (stockFilter === 'low' && !product.isLowStock) return false
      if (stockFilter === 'expiring' && !product.lots.some((lot) => lot.isExpiringSoon)) return false
      return true
    })
  }, [products, search, stockFilter])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Depósito</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Inventario</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-content-muted">
          Mirá qué hay, cargá mercadería y controlá los bolsones con pocas pantallas.
        </p>
      </div>

      {message && (
        <p className="mt-6 rounded-box border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <section className="mt-8 rounded-box border border-line bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div
            className="tabs tabs-bordered grid w-full grid-cols-4 gap-0 rounded-box border border-line bg-surface-alt p-0.5 sm:flex sm:w-fit sm:max-w-full sm:flex-nowrap sm:overflow-x-auto"
            role="tablist"
            aria-label="Vistas de inventario"
          >
            <TabButton active={activeView === 'stock'} label="Stock" onClick={() => setActiveView('stock')} />
            <TabButton active={activeView === 'movements'} label="Historial" onClick={() => setActiveView('movements')} />
            <TabButton active={activeView === 'bolsones'} label="Bolsones" onClick={() => setActiveView('bolsones')} />
            <TabButton active={activeView === 'catalog'} label="Catálogo" onClick={() => setActiveView('catalog')} />
          </div>
          <div className="hidden flex-wrap gap-2 lg:flex">
            <button className="btn btn-primary" onClick={() => openLoad('physicalCount')} type="button">
              <IconPlus aria-hidden="true" className="h-4 w-4" />
              Cargar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div aria-busy="true" aria-label="Cargando inventario" className="mt-6 rounded-box border border-line bg-surface-alt p-8 text-center" role="status">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="mt-3 text-sm text-content-muted">Cargando productos y saldos…</p>
          </div>
        ) : (
          <>
            {activeView === 'stock' && (
              <StockView
                expandedProductId={expandedProductId}
                filteredProducts={filteredProducts}
                listPage={listPage}
                onExpand={setExpandedProductId}
                onListPageChange={setListPage}
                onLoad={openLoad}
                onSearch={setSearch}
                search={search}
                stockFilter={stockFilter}
                onStockFilter={setStockFilter}
              />
            )}
            {activeView === 'movements' && (
              <MovementView
                listPage={listPage}
                movements={overview?.data.recentMovements ?? []}
                onCorrect={setCorrectionTarget}
                onListPageChange={setListPage}
              />
            )}
            {activeView === 'bolsones' && (
              <BolsonesView
                listPage={listPage}
                onListPageChange={setListPage}
                onNewRecipe={() => { setEditingRecipe(null); setDialog('recipe') }}
                onNewVersion={(recipe) => { setEditingRecipe(recipe); setDialog('recipe') }}
                recipes={recipes}
              />
            )}
            {activeView === 'catalog' && (
              <CatalogView
                categories={categories}
                listPage={listPage}
                onDeactivate={setDeactivationTarget}
                onEditCategory={(category) => { setEditingCategory(category); setDialog('category') }}
                onEditProduct={(product) => { setEditingProduct(product); setDialog('product') }}
                onListPageChange={setListPage}
                onNewCategory={() => { setEditingCategory(null); setDialog('category') }}
                onNewProduct={() => { setEditingProduct(null); setDialog('product') }}
                onReactivate={(product) => void reactivateProduct(product)}
                products={products}
              />
            )}
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-4 backdrop-blur lg:hidden">
        <button className="btn btn-primary btn-block" onClick={() => openLoad('physicalCount')} type="button">
          <IconPlus aria-hidden="true" className="h-5 w-5" />
          Cargar
        </button>
      </div>

      {dialog === 'category' && (
        <AppDialog
          description="Agrupá productos para encontrarlos más rápido."
          onClose={closeDialog}
          placement="middle"
          title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        >
          <CategoryForm category={editingCategory} onCancel={closeDialog} onSaved={handleSaved} />
        </AppDialog>
      )}

      {dialog === 'product' && (
        <AppDialog
          description="Definí cómo se va a controlar dentro del depósito."
          onClose={closeDialog}
          placement="middle"
          title={editingProduct ? 'Editar producto' : 'Nuevo producto'}
        >
          <ProductForm categories={categories} onCancel={closeDialog} onSaved={handleSaved} product={editingProduct} />
        </AppDialog>
      )}

      {dialog === 'load' && (
        <AppDialog
          description="Elegí qué querés hacer y agregá los productos de una vez."
          onClose={closeDialog}
          placement="middle"
          size="xl"
          title="Cargar"
        >
          <LoadForm
            initialIntent={loadIntent}
            initialProductId={loadProductId}
            onCancel={closeDialog}
            onSaved={handleSaved}
            products={products}
          />
        </AppDialog>
      )}

      {dialog === 'recipe' && (
        <AppDialog
          description="Cada cambio guarda una versión nueva. La anterior queda registrada."
          onClose={closeDialog}
          placement="middle"
          title={editingRecipe?.currentVersion ? `Cambiar composición · ${editingRecipe.bundleName}` : 'Nuevo bolsón'}
        >
          <RecipeForm onCancel={closeDialog} onSaved={handleSaved} products={products} recipe={editingRecipe} />
        </AppDialog>
      )}

      {deactivationTarget && (
        <AppDialog
          description={`${deactivationTarget.name} conservará su stock e historial, pero no podrá recibir entradas ni formar parte de bolsones.`}
          onClose={() => setDeactivationTarget(null)}
          placement="middle"
          size="md"
          title="Dejar de usar producto"
        >
          <AppDialogBody>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Motivo obligatorio</span>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full bg-surface text-content"
                onChange={(event) => setDeactivationReason(event.target.value)}
                value={deactivationReason}
              />
            </label>
          </AppDialogBody>
          <AppDialogFooter>
            <button className="btn btn-ghost min-h-11" onClick={() => setDeactivationTarget(null)} type="button">Cancelar</button>
            <button className="btn btn-error min-h-11" disabled={!deactivationReason.trim()} onClick={() => void deactivateProduct()} type="button">
              Confirmar
            </button>
          </AppDialogFooter>
        </AppDialog>
      )}

      {correctionTarget && (
        <AppDialog
          description="Se registrará un ajuste compensatorio. El movimiento original quedará anulado."
          onClose={() => setCorrectionTarget(null)}
          placement="middle"
          size="md"
          title="Deshacer movimiento"
        >
          <AppDialogBody>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Motivo obligatorio</span>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full bg-surface text-content"
                onChange={(event) => setCorrectionReason(event.target.value)}
                value={correctionReason}
              />
            </label>
          </AppDialogBody>
          <AppDialogFooter>
            <button className="btn btn-ghost min-h-11" onClick={() => setCorrectionTarget(null)} type="button">Cancelar</button>
            <button className="btn btn-error min-h-11" disabled={!correctionReason.trim()} onClick={() => void correctMovement()} type="button">
              Confirmar
            </button>
          </AppDialogFooter>
        </AppDialog>
      )}
    </main>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-selected={active}
      className={`tab min-h-9 min-w-0 flex-1 truncate px-1.5 text-xs font-semibold sm:min-h-11 sm:flex-none sm:px-4 sm:text-sm ${active ? 'tab-active' : ''}`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  )
}

function InventoryListPagination({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginación" className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-content-muted">
        Página {page} de {totalPages}
      </p>
      <div className="join grid w-full grid-cols-2 sm:w-auto">
        <button
          aria-label="Página anterior"
          className="btn btn-outline btn-sm join-item min-h-10"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Anterior
        </button>
        <button
          aria-label="Página siguiente"
          className="btn btn-outline btn-sm join-item min-h-10"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Siguiente
        </button>
      </div>
    </nav>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`} onClick={onClick} type="button">
      {label}
    </button>
  )
}

function ProductStockCard({
  expanded,
  onExpand,
  onLoad,
  product,
}: {
  expanded: boolean
  onExpand: (productId: string | null) => void
  onLoad: (intent: LoadIntent, productId?: string) => void
  product: InventoryProduct
}) {
  const hasExpiringLot = product.lots.some((lot) => lot.isExpiringSoon)
  const hasExpiredLot = product.lots.some((lot) => lot.isExpired)
  const accent = !product.isActive
    ? 'border-l-line'
    : hasExpiredLot
      ? 'border-l-error'
      : product.isLowStock
        ? 'border-l-warning'
        : hasExpiringLot
          ? 'border-l-error'
          : 'border-l-primary'

  return (
    <article className={`rounded-box border border-line border-l-4 bg-surface ${accent}`}>
      <button
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => onExpand(expanded ? null : product.id)}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-content sm:text-base">{product.name}</h2>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-xs text-content-muted">{relationLabel(product.category, 'Sin categoría')}</p>
            {!product.isActive && <span className="badge badge-ghost badge-xs shrink-0">{PRODUCT_ACTIVE_LABELS.inactive}</span>}
            {product.isLowStock && (
              <span className="badge badge-warning badge-xs shrink-0 gap-1">
                <IconAlertTriangle aria-hidden="true" className="h-3 w-3" />
                Bajo mínimo
              </span>
            )}
            {hasExpiredLot && <span className="badge badge-error badge-xs shrink-0">Vencido</span>}
            {hasExpiringLot && !hasExpiredLot && <span className="badge badge-error badge-xs shrink-0">Por vencer</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-content-muted">Cantidad</p>
          <p className="text-lg font-bold tabular-nums leading-none text-content">{product.totalQuantity}</p>
        </div>
        {expanded ? (
          <IconChevronUp aria-hidden="true" className="h-4 w-4 shrink-0 text-content-muted" />
        ) : (
          <IconChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-content-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          <p className="text-xs text-content-muted">Stock mínimo {product.minimumStock}</p>
          {product.lots.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-content-muted">
              {product.lots.map((lot) => (
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-surface-alt px-3 py-2" key={lot.id}>
                  <span>
                    Lote {lot.code} · vence {lot.expirationDate.slice(0, 10)}
                    {lot.isExpired && <span className="ml-2 font-semibold text-error">Vencido</span>}
                    {!lot.isExpired && lot.isExpiringSoon && <span className="ml-2 font-semibold text-error">Por vencer</span>}
                  </span>
                  <span className="font-semibold text-content">Cantidad {lot.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-content-muted">Sin control de lote.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-outline btn-sm min-h-10" onClick={() => onLoad('entry', product.id)} type="button">Entrada</button>
            <button className="btn btn-outline btn-sm min-h-10" onClick={() => onLoad('exit', product.id)} type="button">Salida</button>
            <button className="btn btn-primary btn-sm min-h-10" onClick={() => onLoad('physicalCount', product.id)} type="button">Conteo</button>
          </div>
        </div>
      )}
    </article>
  )
}

function StockView({
  expandedProductId,
  filteredProducts,
  listPage,
  onExpand,
  onListPageChange,
  onLoad,
  onSearch,
  onStockFilter,
  search,
  stockFilter,
}: {
  expandedProductId: string | null
  filteredProducts: InventoryProduct[]
  listPage: number
  onExpand: (productId: string | null) => void
  onListPageChange: (page: number) => void
  onLoad: (intent: LoadIntent, productId?: string) => void
  onSearch: (value: string) => void
  onStockFilter: (filter: StockFilter) => void
  search: string
  stockFilter: StockFilter
}) {
  const { items: pageProducts, safePage, totalPages } = getInventoryPageSlice(filteredProducts, listPage)

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex-1">
          <span className="sr-only">Buscar productos</span>
          <input
            aria-label="Buscar productos"
            className="input input-bordered h-12 w-full bg-surface text-content"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar productos…"
            type="search"
            value={search}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={stockFilter === 'all'} label="Todos" onClick={() => onStockFilter('all')} />
          <FilterChip active={stockFilter === 'low'} label="Falta" onClick={() => onStockFilter('low')} />
          <FilterChip active={stockFilter === 'expiring'} label="Por vencer" onClick={() => onStockFilter('expiring')} />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-box border border-dashed border-line p-8 text-center" role="status">
          <IconPackages aria-hidden="true" className="mx-auto h-10 w-10 text-content-muted" />
          <h2 className="mt-3 font-bold text-content">No hay productos para mostrar</h2>
          <p className="mt-1 text-sm text-content-muted">Probá otro filtro o cargá el depósito desde Catálogo.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {pageProducts.map((product) => (
              <ProductStockCard
                expanded={expandedProductId === product.id}
                key={product.id}
                onExpand={onExpand}
                onLoad={onLoad}
                product={product}
              />
            ))}
          </div>
          <InventoryListPagination onPageChange={onListPageChange} page={safePage} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}

function CatalogView({
  categories,
  listPage,
  onDeactivate,
  onEditCategory,
  onEditProduct,
  onListPageChange,
  onNewCategory,
  onNewProduct,
  onReactivate,
  products,
}: {
  categories: InventoryCategory[]
  listPage: number
  onDeactivate: (product: InventoryProduct) => void
  onEditCategory: (category: InventoryCategory) => void
  onEditProduct: (product: InventoryProduct) => void
  onListPageChange: (page: number) => void
  onNewCategory: () => void
  onNewProduct: () => void
  onReactivate: (product: InventoryProduct) => void
  products: InventoryProduct[]
}) {
  const { items: pageProducts, safePage, totalPages } = getInventoryPageSlice(products, listPage)

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-outline" onClick={onNewCategory} type="button">Nueva categoría</button>
        <button className="btn btn-primary" onClick={onNewProduct} type="button">Nuevo producto</button>
      </div>

      {categories.length > 0 && (
        <section aria-label="Categorías">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">Categorías</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                className={`btn btn-sm ${category.isActive ? 'btn-outline' : 'btn-ghost'}`}
                key={category.id}
                onClick={() => onEditCategory(category)}
                type="button"
              >
                {category.name}
                {category.isActive ? '' : ' · Inactiva'}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
        {pageProducts.map((product) => (
          <article className="flex flex-col gap-3 rounded-box border border-line bg-surface-alt p-4 sm:flex-row sm:items-center sm:justify-between" key={product.id}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-content">{product.name}</h2>
                <span className={`badge ${product.isActive ? 'badge-success' : 'badge-ghost'}`}>
                  {product.isActive ? PRODUCT_ACTIVE_LABELS.active : PRODUCT_ACTIVE_LABELS.inactive}
                </span>
              </div>
              <p className="mt-1 text-sm text-content-muted">
                {relationLabel(product.category, 'Sin categoría')} · mínimo {product.minimumStock}
                {product.tracksLotExpiration ? ' · con lote/vencimiento' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => onEditProduct(product)} type="button">
                <IconEdit aria-hidden="true" className="h-4 w-4" />
                Editar
              </button>
              {product.isActive ? (
                <button className="btn btn-ghost btn-sm" onClick={() => onDeactivate(product)} type="button">
                  <IconArchive aria-hidden="true" className="h-4 w-4" />
                  Dejar de usar
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => onReactivate(product)} type="button">Volver a usar</button>
              )}
            </div>
          </article>
        ))}
      </div>
      <InventoryListPagination onPageChange={onListPageChange} page={safePage} totalPages={totalPages} />
    </div>
  )
}

function MovementView({
  listPage,
  movements,
  onCorrect,
  onListPageChange,
}: {
  listPage: number
  movements: InventoryMovement[]
  onCorrect: (movement: InventoryMovement) => void
  onListPageChange: (page: number) => void
}) {
  const { items: pageMovements, safePage, totalPages } = getInventoryPageSlice(movements, listPage)

  return (
    <div className="mt-6">
      {movements.length === 0 ? (
        <div className="rounded-box border border-dashed border-line p-8 text-center" role="status">
          <IconHistory aria-hidden="true" className="mx-auto h-10 w-10 text-content-muted" />
          <h2 className="mt-3 font-bold text-content">Todavía no hay movimientos</h2>
          <p className="mt-1 text-sm text-content-muted">Las cargas, salidas y conteos aparecerán acá.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pageMovements.map((movement) => {
              const isIncrease =
                movement.movementType === 'entry' ||
                (movement.movementType === 'adjustment' && movement.resultingQuantity >= movement.previousQuantity)
              const sign = isIncrease ? '+' : '-'
              const cannotCorrect = movement.referenceType === 'delivery'

              return (
                <article className="flex flex-col gap-3 rounded-box border border-line bg-surface-alt p-4 sm:flex-row sm:items-center sm:justify-between" key={movement.id}>
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                      movement.movementType === 'entry' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                    }`}
                  >
                    <IconPackages aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-content">
                        {relationLabel(movement.product, 'Producto')} · {movementReasonLabel(movement.reason)}
                      </p>
                      {movement.status === 'corrected' && <span className="badge badge-ghost">Anulado</span>}
                      {movement.correctionOf && <span className="badge badge-warning">Corrección</span>}
                      {movement.referenceType === 'delivery' && <span className="badge badge-outline">Entrega</span>}
                    </div>
                    <p className="mt-1 text-sm text-content-muted">
                      {movement.operationalDate} · {movementTypeLabel(movement.movementType)}
                    </p>
                    {cannotCorrect && movement.status === 'active' && !movement.correctionOf && (
                      <p className="mt-1 text-xs text-content-muted">Este movimiento viene de una entrega y se corrige desde Entregas.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-content">{sign}{movement.quantity}</p>
                  {canCorrectMovement(movement) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onCorrect(movement)} type="button">Deshacer</button>
                  )}
                </div>
                </article>
              )
            })}
          </div>
          <InventoryListPagination onPageChange={onListPageChange} page={safePage} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}

function BolsonesView({
  listPage,
  onListPageChange,
  onNewRecipe,
  onNewVersion,
  recipes,
}: {
  listPage: number
  onListPageChange: (page: number) => void
  onNewRecipe: () => void
  onNewVersion: (recipe: RecipeSummary) => void
  recipes: RecipeSummary[]
}) {
  const { items: pageRecipes, safePage, totalPages } = getInventoryPageSlice(recipes, listPage)
  if (recipes.length === 0) {
    return (
      <div className="mt-6 rounded-box border border-dashed border-line bg-surface-alt p-8 text-center">
        <IconPackages aria-hidden="true" className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-lg font-bold text-content">Bolsones</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-content-muted">
          Definí qué lleva cada bolsón. El sistema calcula cuántos se pueden armar con el stock actual.
        </p>
        <button className="btn btn-primary mt-5" onClick={onNewRecipe} type="button">
          <IconPlus aria-hidden="true" className="h-4 w-4" />
          Nuevo bolsón
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={onNewRecipe} type="button">
          <IconPlus aria-hidden="true" className="h-4 w-4" />
          Nuevo bolsón
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {pageRecipes.map((recipe) => (
          <article className="rounded-box border border-line bg-surface-alt p-5" key={recipe.bundleId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-content">{recipe.bundleName}</h2>
                {recipe.currentVersion && (
                  <p className="mt-1 text-sm text-content-muted">
                    Versión {recipe.currentVersion.version} · desde {recipe.currentVersion.effectiveFrom.slice(0, 10)}
                  </p>
                )}
              </div>
              <span className={`badge ${recipe.isActive ? 'badge-success' : 'badge-ghost'}`}>
                {recipe.isActive ? PRODUCT_ACTIVE_LABELS.active : PRODUCT_ACTIVE_LABELS.inactive}
              </span>
            </div>
            {recipe.currentVersion ? (
              <>
                <p className="mt-4 text-2xl font-bold text-content">
                  Se pueden armar {recipe.capacity} bolsón{recipe.capacity === 1 ? '' : 'es'}
                </p>
                {recipe.limitingProduct && (
                  <p className="mt-1 text-sm text-content-muted">Falta más de: {recipe.limitingProduct.name}</p>
                )}
                <ul className="mt-4 space-y-1 text-sm text-content-muted">
                  {recipe.currentVersion.lines.map((line) => (
                    <li key={line.productId}>{line.productName}: {line.quantity}</li>
                  ))}
                </ul>
                <button
                  className="btn btn-outline btn-sm mt-4"
                  disabled={!recipe.isActive}
                  onClick={() => onNewVersion(recipe)}
                  type="button"
                >
                  Cambiar composición
                </button>
              </>
            ) : (
              <p className="mt-4 text-sm text-content-muted">Sin versión vigente.</p>
            )}
          </article>
        ))}
      </div>
      <InventoryListPagination onPageChange={onListPageChange} page={safePage} totalPages={totalPages} />
    </div>
  )
}
