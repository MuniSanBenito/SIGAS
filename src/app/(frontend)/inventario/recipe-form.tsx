'use client'

import { useEffect, useState, type FormEvent } from 'react'

import type { InventoryProduct, RecipeSummary } from './inventory-ui-types'

type RecipeLine = { productId: string; quantity: string }

type RecipeFormProps = {
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
  products: InventoryProduct[]
  recipe?: RecipeSummary | null
}

export function RecipeForm({ onCancel, onSaved, products, recipe }: RecipeFormProps) {
  const activeProducts = products.filter((product) => product.isActive)
  const editingVersion = Boolean(recipe?.currentVersion)
  const [bundleName, setBundleName] = useState(recipe?.bundleName ?? '')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<RecipeLine[]>(
    recipe?.currentVersion?.lines.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })) ?? [
      { productId: activeProducts[0]?.id ?? '', quantity: '1' },
    ],
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!recipe) return
    setBundleName(recipe.bundleName)
    if (recipe.currentVersion) {
      setLines(recipe.currentVersion.lines.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })))
    }
  }, [recipe])

  function updateLine(index: number, field: keyof RecipeLine, value: string) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line))
  }

  function addLine() {
    setLines((current) => [...current, { productId: activeProducts[0]?.id ?? '', quantity: '1' }])
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/inventory/recipes', {
        body: JSON.stringify({
          ...(recipe ? { bundleId: recipe.bundleId } : {}),
          bundleName: bundleName.trim(),
          effectiveFrom,
          lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
        }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? 'No se pudo guardar la receta.')
      await onSaved(editingVersion ? 'Nueva versión de receta guardada correctamente.' : 'Receta versionada correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo guardar la receta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-bold text-content">
          {editingVersion ? `Nueva versión · ${recipe?.bundleName}` : 'Nueva receta de bolsón'}
        </h2>
        <p className="mt-1 text-sm text-content-muted">Cada guardado crea una versión inmutable. La anterior queda en el historial.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-content">Nombre del bolsón</span>
          <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setBundleName(event.target.value)} required value={bundleName} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-content">Vigente desde</span>
          <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setEffectiveFrom(event.target.value)} required type="date" value={effectiveFrom} />
        </label>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-content">Productos de la receta</legend>
        {lines.map((line, index) => (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" key={`${index}-${line.productId}`}>
            <label className="sr-only" htmlFor={`recipe-product-${index}`}>Producto de la línea {index + 1}</label>
            <select className="select select-bordered h-12 w-full bg-surface text-content" id={`recipe-product-${index}`} onChange={(event) => updateLine(index, 'productId', event.target.value)} required value={line.productId}>
              <option disabled value="">Seleccioná un producto</option>
              {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <label className="sr-only" htmlFor={`recipe-quantity-${index}`}>Cantidad de la línea {index + 1}</label>
            <input className="input input-bordered h-12 w-full bg-surface text-content" id={`recipe-quantity-${index}`} min="1" onChange={(event) => updateLine(index, 'quantity', event.target.value)} required type="number" value={line.quantity} />
            <button aria-label={`Quitar producto ${index + 1}`} className="btn btn-ghost h-12" disabled={lines.length === 1} onClick={() => removeLine(index)} type="button">Quitar</button>
          </div>
        ))}
      </fieldset>
      <button className="btn btn-outline btn-sm" disabled={activeProducts.length === 0} onClick={addLine} type="button">Agregar producto</button>
      {activeProducts.length === 0 && <p className="rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert">Necesitás al menos un producto activo.</p>}
      {error && <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="btn btn-ghost" onClick={onCancel} type="button">Cancelar</button>
        <button className="btn btn-primary" disabled={isSubmitting || activeProducts.length === 0} type="submit">{isSubmitting ? 'Guardando…' : editingVersion ? 'Guardar nueva versión' : 'Guardar versión'}</button>
      </div>
    </form>
  )
}
