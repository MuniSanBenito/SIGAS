'use client'

import { useState, type FormEvent } from 'react'

type CategoryFormProps = {
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
}

export function CategoryForm({ onCancel, onSaved }: CategoryFormProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/product-categories', {
        body: JSON.stringify({ isActive: true, name: name.trim() }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? 'No se pudo crear la categoría.')
      await onSaved('Categoría creada correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo crear la categoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <form className="space-y-5" onSubmit={handleSubmit}><div><h2 className="text-xl font-bold text-content">Nueva categoría</h2><p className="mt-1 text-sm text-content-muted">Agrupá productos para encontrarlos más rápido.</p></div><label className="space-y-2"><span className="text-sm font-semibold text-content">Nombre</span><input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setName(event.target.value)} required value={name} /></label>{error && <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className="btn btn-ghost" onClick={onCancel} type="button">Cancelar</button><button className="btn btn-primary" disabled={isSubmitting} type="submit">{isSubmitting ? 'Guardando…' : 'Crear categoría'}</button></div></form>
}
