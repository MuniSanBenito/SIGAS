'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { AppDialogBody, AppDialogFooter } from '../app-dialog'
import type { InventoryProduct } from './inventory-ui-types'

type Category = { id: string; name: string }

type ProductFormProps = {
  categories: Category[]
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
  product?: InventoryProduct | null
}

export function ProductForm({ categories, onCancel, onSaved, product }: ProductFormProps) {
  const editing = Boolean(product)
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(
    typeof product?.category === 'object' ? product.category.id : product?.category ?? categories[0]?.id ?? '',
  )
  const [minimumStock, setMinimumStock] = useState(String(product?.minimumStock ?? 0))
  const [tracksLotExpiration, setTracksLotExpiration] = useState(product?.tracksLotExpiration ?? false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lotLocked = editing && (product?.hasMovements ?? false)

  useEffect(() => {
    if (!product) return
    setName(product.name)
    setCategory(typeof product.category === 'object' ? product.category.id : product.category)
    setMinimumStock(String(product.minimumStock))
    setTracksLotExpiration(product.tracksLotExpiration)
  }, [product])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        category: category,
        minimumStock: Number(minimumStock),
        name: name.trim(),
        ...(lotLocked ? {} : { tracksLotExpiration }),
      }
      const response = await fetch(
        editing ? `/api/inventory/products/${product?.id}` : '/api/inventory/products',
        {
          body: JSON.stringify(payload),
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? body?.errors?.[0]?.message ?? 'No se pudo guardar el producto.')
      await onSaved(editing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo guardar el producto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <AppDialogBody>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-semibold text-content">Nombre</span>
              <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Categoría</span>
              <select className="select select-bordered h-12 w-full bg-surface text-content" onChange={(event) => setCategory(event.target.value)} required value={category}>
                <option disabled value="">Seleccioná una categoría</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Stock mínimo</span>
              <input className="input input-bordered h-12 w-full bg-surface text-content" min="0" onChange={(event) => setMinimumStock(event.target.value)} required type="number" value={minimumStock} />
            </label>
          </div>

          <label className="flex min-h-12 items-start gap-3 rounded-box border border-line bg-surface-alt p-4">
            <input checked={tracksLotExpiration} className="checkbox checkbox-primary mt-0.5" disabled={lotLocked} onChange={(event) => setTracksLotExpiration(event.target.checked)} type="checkbox" />
            <span>
              <span className="block text-sm font-semibold text-content">Controlar lote y vencimiento</span>
              <span className="mt-1 block text-sm text-content-muted">
                {lotLocked ? 'Esta configuración queda fija después del primer movimiento.' : 'Podés cambiarla solo antes del primer movimiento.'}
              </span>
            </span>
          </label>

          {categories.length === 0 && <p className="rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert">Primero necesitás crear una categoría.</p>}
          {error && <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}
        </div>
      </AppDialogBody>
      <AppDialogFooter>
        <button className="btn btn-ghost min-h-11" onClick={onCancel} type="button">Cancelar</button>
        <button className="btn btn-primary min-h-11" disabled={isSubmitting || !category} type="submit">{isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}</button>
      </AppDialogFooter>
    </form>
  )
}
