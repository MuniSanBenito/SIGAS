'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'

import { AppDialogBody, AppDialogFooter } from '../app-dialog'
import type { InventoryProduct } from './inventory-ui-types'

export type LoadIntent = 'physicalCount' | 'entry' | 'exit'

type LoadLine = {
  countedQuantity: string
  expirationDate: string
  id: string
  lotCode: string
  lotId: string
  productId: string
  quantity: string
}

type LoadFormProps = {
  initialIntent?: LoadIntent
  initialProductId?: string
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
  products: InventoryProduct[]
}

const INTENT_OPTIONS: Array<{ description: string; intent: LoadIntent; label: string }> = [
  {
    description: 'Dejá el stock en el número que contaste.',
    intent: 'physicalCount',
    label: 'Esto es lo que hay',
  },
  {
    description: 'Sumá mercadería que llegó al depósito.',
    intent: 'entry',
    label: 'Llegó mercadería',
  },
  {
    description: 'Sacá lo que se perdió, venció o se rompió.',
    intent: 'exit',
    label: 'Se perdió o venció',
  },
]

export function LoadForm({
  initialIntent = 'physicalCount',
  initialProductId,
  onCancel,
  onSaved,
  products,
}: LoadFormProps) {
  const [intent, setIntent] = useState<LoadIntent>(initialIntent)
  const [entryReason, setEntryReason] = useState<'purchase' | 'donation'>('purchase')
  const [exitReason, setExitReason] = useState<'loss' | 'expiration' | 'breakage'>('loss')
  const [observation, setObservation] = useState('')
  const [lines, setLines] = useState<LoadLine[]>(() => [
    createLine(initialProductId ?? products[0]?.id ?? ''),
  ])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const usableProducts = useMemo(
    () => products.filter((product) => intent === 'exit' || intent === 'physicalCount' || product.isActive),
    [intent, products],
  )

  function createLine(productId = ''): LoadLine {
    return {
      countedQuantity: '0',
      expirationDate: '',
      id: crypto.randomUUID(),
      lotCode: '',
      lotId: '',
      productId,
      quantity: '1',
    }
  }

  function updateLine(lineId: string, patch: Partial<LoadLine>) {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((current) => [...current, createLine(usableProducts[0]?.id ?? '')])
  }

  function removeLine(lineId: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== lineId)))
  }

  async function createLotIfNeeded(product: InventoryProduct, line: LoadLine): Promise<string | undefined> {
    if (!product.tracksLotExpiration) return undefined
    if (intent !== 'entry') return line.lotId || undefined

    if (line.lotId && line.lotId !== 'new') return line.lotId

    const response = await fetch('/api/product-lots', {
      body: JSON.stringify({
        code: line.lotCode.trim(),
        expirationDate: line.expirationDate,
        isActive: true,
        product: line.productId,
      }),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? 'No se pudo crear el lote.')
    return body?.doc?.id ?? body?.id
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const operationalDate = new Date().toISOString().slice(0, 10)
      const batchLines = []

      for (const line of lines) {
        if (!line.productId) throw new Error('Seleccioná un producto en cada línea.')
        const product = products.find((item) => item.id === line.productId)
        if (!product) throw new Error('Hay un producto que ya no existe.')

        const lotId = await createLotIfNeeded(product, line)

        if (product.tracksLotExpiration && intent !== 'entry' && !lotId) {
          throw new Error(`Seleccioná un lote para ${product.name}.`)
        }

        const movement =
          intent === 'physicalCount'
            ? {
                countedQuantity: Number(line.countedQuantity),
                lotId,
                mode: 'physicalCount',
                observation: observation.trim() || undefined,
                operationalDate,
                productId: line.productId,
              }
            : intent === 'entry'
              ? {
                  lotId,
                  mode: 'entry',
                  observation: observation.trim() || undefined,
                  operationalDate,
                  productId: line.productId,
                  quantity: Number(line.quantity),
                  reason: entryReason,
                }
              : {
                  lotId,
                  mode: 'exit',
                  observation: observation.trim() || undefined,
                  operationalDate,
                  productId: line.productId,
                  quantity: Number(line.quantity),
                  reason: exitReason,
                }

        batchLines.push({ lineKey: line.id, movement })
      }

      const response = await fetch('/api/inventory/movements/batch', {
        body: JSON.stringify({
          batchOperationKey: crypto.randomUUID(),
          lines: batchLines,
        }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? 'No se pudo registrar la carga.')

      const succeeded = body?.data?.succeeded ?? 0
      const failed = body?.data?.failed ?? 0

      if (failed > 0 && succeeded === 0) {
        const firstError = body?.data?.results?.find((result: { ok: boolean; message?: string }) => !result.ok)?.message
        throw new Error(firstError ?? 'No se pudo registrar la carga.')
      }

      const message =
        failed > 0
          ? `Se cargaron ${succeeded} producto${succeeded === 1 ? '' : 's'}. ${failed} no se pudieron guardar.`
          : intent === 'physicalCount'
            ? `Conteo guardado para ${succeeded} producto${succeeded === 1 ? '' : 's'}.`
            : intent === 'entry'
              ? `Mercadería cargada para ${succeeded} producto${succeeded === 1 ? '' : 's'}.`
              : `Salida registrada para ${succeeded} producto${succeeded === 1 ? '' : 's'}.`

      await onSaved(message)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo registrar la carga.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <AppDialogBody>
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            {INTENT_OPTIONS.map((option) => (
              <button
                aria-pressed={intent === option.intent}
                className={`rounded-box border px-4 py-3 text-left transition sm:p-4 ${intent === option.intent ? 'border-primary bg-primary/10' : 'border-line bg-surface-alt hover:border-primary/40'}`}
                key={option.intent}
                onClick={() => setIntent(option.intent)}
                type="button"
              >
                <p className="font-semibold text-content">{option.label}</p>
                <p className="mt-1 text-sm text-content-muted">{option.description}</p>
              </button>
            ))}
          </div>

          {intent === 'entry' && (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Motivo de la entrada</span>
              <select
                className="select select-bordered h-12 w-full bg-surface text-content"
                onChange={(event) => setEntryReason(event.target.value as 'purchase' | 'donation')}
                value={entryReason}
              >
                <option value="purchase">Compra</option>
                <option value="donation">Donación</option>
              </select>
            </label>
          )}

          {intent === 'exit' && (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Motivo de la salida</span>
              <select
                className="select select-bordered h-12 w-full bg-surface text-content"
                onChange={(event) => setExitReason(event.target.value as 'loss' | 'expiration' | 'breakage')}
                value={exitReason}
              >
                <option value="loss">Pérdida</option>
                <option value="expiration">Vencimiento</option>
                <option value="breakage">Rotura</option>
              </select>
            </label>
          )}

          <div className="space-y-4">
            {lines.map((line, index) => {
              const product = products.find((item) => item.id === line.productId)
              const isLotControlled = product?.tracksLotExpiration ?? false
              const requiresNewLot = intent === 'entry' && isLotControlled && (line.lotId === '' || line.lotId === 'new')

              return (
                <article className="rounded-box border border-line bg-surface-alt p-4" key={line.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-content">Producto {index + 1}</p>
                    <button
                      aria-label={`Quitar producto ${index + 1}`}
                      className="btn btn-ghost btn-sm"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.id)}
                      type="button"
                    >
                      <IconTrash aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-sm font-semibold text-content">Producto</span>
                      <select
                        className="select select-bordered h-12 w-full bg-surface text-content"
                        onChange={(event) =>
                          updateLine(line.id, {
                            expirationDate: '',
                            lotCode: '',
                            lotId: '',
                            productId: event.target.value,
                          })
                        }
                        required
                        value={line.productId}
                      >
                        <option disabled value="">Seleccioná un producto</option>
                        {usableProducts.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                            {item.isActive ? '' : ' · Dejó de usarse'}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isLotControlled && (
                      <label className="space-y-2 sm:col-span-2">
                        <span className="text-sm font-semibold text-content">Lote</span>
                        <select
                          className="select select-bordered h-12 w-full bg-surface text-content"
                          onChange={(event) => updateLine(line.id, { lotId: event.target.value })}
                          required={intent !== 'entry'}
                          value={line.lotId}
                        >
                          <option value="">{intent === 'entry' ? 'Crear un lote nuevo' : 'Seleccioná un lote'}</option>
                          {intent === 'entry' && <option value="new">Crear un lote nuevo</option>}
                          {product?.lots.map((lot) => (
                            <option disabled={lot.isExpired} key={lot.id} value={lot.id}>
                              {lot.code} · vence {lot.expirationDate.slice(0, 10)} · hay {lot.quantity}
                              {lot.isExpired ? ' · Vencido' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {requiresNewLot && (
                      <>
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-content">Código de lote</span>
                          <input
                            className="input input-bordered h-12 w-full bg-surface text-content"
                            onChange={(event) => updateLine(line.id, { lotCode: event.target.value })}
                            required
                            value={line.lotCode}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-content">Vencimiento</span>
                          <input
                            className="input input-bordered h-12 w-full bg-surface text-content"
                            onChange={(event) => updateLine(line.id, { expirationDate: event.target.value })}
                            required
                            type="date"
                            value={line.expirationDate}
                          />
                        </label>
                      </>
                    )}

                    {intent === 'physicalCount' ? (
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-content">Cuánto hay</span>
                        <input
                          className="input input-bordered h-12 w-full bg-surface text-content"
                          min="0"
                          onChange={(event) => updateLine(line.id, { countedQuantity: event.target.value })}
                          required
                          type="number"
                          value={line.countedQuantity}
                        />
                      </label>
                    ) : (
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-content">Cantidad</span>
                        <input
                          className="input input-bordered h-12 w-full bg-surface text-content"
                          min="1"
                          onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                          required
                          type="number"
                          value={line.quantity}
                        />
                      </label>
                    )}

                    {product && (
                      <p className="self-end text-sm text-content-muted sm:col-span-2">
                        Ahora hay {product.totalQuantity} unidad{product.totalQuantity === 1 ? '' : 'es'}.
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <button className="btn btn-outline btn-sm" disabled={usableProducts.length === 0} onClick={addLine} type="button">
            <IconPlus aria-hidden="true" className="h-4 w-4" />
            Agregar otro producto
          </button>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-content">Observación (opcional)</span>
            <textarea
              className="textarea textarea-bordered min-h-24 w-full bg-surface text-content"
              onChange={(event) => setObservation(event.target.value)}
              value={observation}
            />
          </label>

          {error && (
            <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </AppDialogBody>
      <AppDialogFooter>
        <button className="btn btn-ghost min-h-11" onClick={onCancel} type="button">Cancelar</button>
        <button className="btn btn-primary min-h-11" disabled={isSubmitting || usableProducts.length === 0} type="submit">
          {isSubmitting ? 'Guardando…' : 'Confirmar carga'}
        </button>
      </AppDialogFooter>
    </form>
  )
}

