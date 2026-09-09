'use client'

import { useState, type FormEvent } from 'react'

type Category = { id: string; name: string }

type ProductFormProps = {
  categories: Category[]
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
}

export function ProductForm({ categories, onCancel, onSaved }: ProductFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0]?.id ?? '')
  const [minimumStock, setMinimumStock] = useState('0')
  const [tracksLotExpiration, setTracksLotExpiration] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/products', {
        body: JSON.stringify({
          category,
          isActive: true,
          minimumStock: Number(minimumStock),
          name: name.trim(),
          tracksLotExpiration,
        }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? 'No se pudo crear el producto.')
      await onSaved('Producto creado correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo crear el producto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-bold text-content">Nuevo producto</h2>
        <p className="mt-1 text-sm text-content-muted">Definí cómo se va a controlar dentro del depósito.</p>
      </div>

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
        <input checked={tracksLotExpiration} className="checkbox checkbox-primary mt-0.5" onChange={(event) => setTracksLotExpiration(event.target.checked)} type="checkbox" />
        <span>
          <span className="block text-sm font-semibold text-content">Controlar lote y vencimiento</span>
          <span className="mt-1 block text-sm text-content-muted">Esta configuración queda fija después del primer movimiento.</span>
        </span>
      </label>

      {categories.length === 0 && <p className="rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert">Primero necesitás crear una categoría desde Payload Admin.</p>}
      {error && <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn btn-ghost" onClick={onCancel} type="button">Cancelar</button>
        <button className="btn btn-primary" disabled={isSubmitting || !category} type="submit">{isSubmitting ? 'Guardando…' : 'Crear producto'}</button>
      </div>
    </form>
  )
}
