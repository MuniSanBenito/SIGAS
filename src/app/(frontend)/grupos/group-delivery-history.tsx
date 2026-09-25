'use client'

import { useEffect, useState } from 'react'

type HistoryLine = { productName: string; quantity: number }
type HistoryBundle = { name: string; quantity: number }
type HistoryAssistance = {
  kind: string
  description: string
  quantity?: number | null
  amountPesos?: number | null
}
type HistoryItem = {
  id: string
  deliveryDate: string
  lines: HistoryLine[]
  bundles: HistoryBundle[]
  assistances: HistoryAssistance[]
}

const assistanceLabels: Record<string, string> = {
  atmospheric: 'Subsidio atmosférico',
  materials: 'Materiales',
  money: 'Dinero',
  funeral: 'Sepelio',
  medication: 'Medicamento',
  orthopedic: 'Préstamo ortopédico',
}

function formatDeliveryDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function describeItem(item: HistoryItem): string[] {
  const parts = [
    ...item.bundles.map((bundle) => `${bundle.name} × ${bundle.quantity}`),
    ...item.lines.map((line) => `${line.productName} × ${line.quantity}`),
    ...item.assistances.map((assistance) => {
      const label = assistanceLabels[assistance.kind] ?? assistance.kind
      const amount = assistance.amountPesos != null ? ` · $${assistance.amountPesos}` : ''
      const quantity = assistance.quantity != null ? ` × ${assistance.quantity}` : ''
      return `${label}: ${assistance.description}${quantity}${amount}`
    }),
  ]
  return parts.length > 0 ? parts : ['Sin detalle de contenido']
}

export function GroupDeliveryHistory({ groupId }: { groupId: string }) {
  const [docs, setDocs] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/entregas/historial?groupId=${encodeURIComponent(groupId)}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message = payload?.error?.message
          throw new Error(typeof message === 'string' ? message : 'No se pudo cargar el historial.')
        }
        setDocs(Array.isArray(payload?.docs) ? payload.docs : [])
      } catch (value) {
        if (value instanceof Error && value.name !== 'AbortError') setError(value.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [groupId])

  return (
    <section aria-label="Historial de entregas" className="mt-8">
      <h2 className="text-xl font-bold text-content">Historial de entregas</h2>
      <p className="mt-1 text-sm text-content-muted">Qué se entregó a este grupo y en qué fecha.</p>

      {error && (
        <div className="alert alert-error mt-4" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-box border border-line bg-surface shadow-sm">
        {loading ? (
          <div aria-label="Cargando historial" aria-live="polite" className="flex min-h-40 items-center justify-center">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : (
          <table className="table table-zebra">
            <caption className="sr-only">Entregas confirmadas del grupo</caption>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Qué se entregó</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-content-muted" colSpan={2}>
                    Este grupo todavía no tiene entregas.
                  </td>
                </tr>
              ) : (
                docs.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap font-semibold">{formatDeliveryDate(item.deliveryDate)}</td>
                    <td>
                      <ul className="space-y-1">
                        {describeItem(item).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
