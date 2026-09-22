'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { AppDialogBody, AppDialogFooter } from '../app-dialog'
import type { InventoryCategory } from './inventory-ui-types'

type CategoryFormProps = {
  category?: InventoryCategory | null
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
}

export function CategoryForm({ category, onCancel, onSaved }: CategoryFormProps) {
  const editing = Boolean(category)
  const [name, setName] = useState(category?.name ?? '')
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!category) return
    setName(category.name)
    setIsActive(category.isActive)
  }, [category])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch(
        editing ? `/api/inventory/categories/${category?.id}` : '/api/inventory/categories',
        {
          body: JSON.stringify(editing ? { isActive, name: name.trim() } : { name: name.trim() }),
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? body?.errors?.[0]?.message ?? 'No se pudo guardar la categoría.')
      await onSaved(editing ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo guardar la categoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <AppDialogBody>
        <div className="space-y-5">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-content">Nombre</span>
            <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          {editing && (
            <label className="flex min-h-12 items-center gap-3 rounded-box border border-line bg-surface-alt p-4">
              <input checked={isActive} className="checkbox checkbox-primary" onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
              <span className="text-sm font-semibold text-content">Categoría activa</span>
            </label>
          )}
          {error && <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}
        </div>
      </AppDialogBody>
      <AppDialogFooter>
        <button className="btn btn-ghost min-h-11" onClick={onCancel} type="button">Cancelar</button>
        <button className="btn btn-primary min-h-11" disabled={isSubmitting} type="submit">{isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría'}</button>
      </AppDialogFooter>
    </form>
  )
}
