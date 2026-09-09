'use client'

import { useMemo, useState, type FormEvent } from 'react'

import type { InventoryProduct } from './inventory-ui-types'

type MovementMode = 'entry' | 'exit' | 'physicalCount'

type MovementFormProps = {
  mode: MovementMode
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
  products: InventoryProduct[]
}

const exitReasons = [
  ['loss', 'Pérdida'],
  ['expiration', 'Vencimiento'],
  ['breakage', 'Rotura'],
  ['adjustment', 'Ajuste manual'],
] as const

export function MovementForm({ mode, onCancel, onSaved, products }: MovementFormProps) {
  const usableProducts = useMemo(
    () => products.filter((product) => mode === 'exit' || mode === 'physicalCount' || product.isActive),
    [mode, products],
  )
  const [productId, setProductId] = useState(usableProducts[0]?.id ?? '')
  const [lotId, setLotId] = useState('')
  const [lotCode, setLotCode] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [countedQuantity, setCountedQuantity] = useState('0')
  const [reason, setReason] = useState<'purchase' | 'donation' | 'loss' | 'expiration' | 'breakage' | 'adjustment'>(mode === 'entry' ? 'purchase' : 'loss')
  const [operationalDate, setOperationalDate] = useState(new Date().toISOString().slice(0, 10))
  const [source, setSource] = useState('')
  const [observation, setObservation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const product = usableProducts.find((item) => item.id === productId)
  const isLotControlled = product?.tracksLotExpiration ?? false
  const requiresNewLot = mode === 'entry' && isLotControlled && (lotId === '' || lotId === 'new')

  function changeProduct(value: string) {
    setProductId(value)
    setLotId('')
    setLotCode('')
    setExpirationDate('')
  }

  async function createLotIfNeeded(): Promise<string | undefined> {
    if (!isLotControlled) return undefined
    if (!requiresNewLot) return lotId
    const response = await fetch('/api/product-lots', {
      body: JSON.stringify({ code: lotCode.trim(), expirationDate, isActive: true, product: productId }),
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
      if (!productId) throw new Error('Seleccioná un producto.')
      if (isLotControlled && mode !== 'entry' && !lotId) throw new Error('Seleccioná un lote.')
      const selectedLotId = await createLotIfNeeded()
      const movement = {
        mode,
        observation: observation.trim() || undefined,
        operationalDate,
        productId,
        ...(selectedLotId ? { lotId: selectedLotId } : {}),
        ...(mode === 'physicalCount' ? { countedQuantity: Number(countedQuantity) } : { quantity: Number(quantity), reason }),
        ...(source.trim() ? { source: source.trim() } : {}),
      }
      const response = await fetch('/api/inventory/movements', {
        body: JSON.stringify({ movement, operationKey: crypto.randomUUID() }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? 'No se pudo registrar el movimiento.')
      await onSaved(mode === 'entry' ? 'Entrada registrada correctamente.' : mode === 'exit' ? 'Baja registrada correctamente.' : 'Conteo físico registrado correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo registrar el movimiento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-bold text-content">{mode === 'entry' ? 'Cargar entrada' : mode === 'exit' ? 'Dar de baja stock' : 'Registrar conteo físico'}</h2>
        <p className="mt-1 text-sm text-content-muted">{mode === 'entry' ? 'La entrada aumenta el saldo del depósito.' : mode === 'exit' ? 'La baja conserva el historial y nunca permite saldo negativo.' : 'El sistema calcula la diferencia contra el saldo actual.'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold text-content">Producto</span>
          <select className="select select-bordered h-12 w-full bg-surface text-content" onChange={(event) => changeProduct(event.target.value)} required value={productId}>
            <option disabled value="">Seleccioná un producto</option>
            {usableProducts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? '' : ' · Inactivo'}</option>)}
          </select>
        </label>

        {isLotControlled && (
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-semibold text-content">Lote</span>
            <select className="select select-bordered h-12 w-full bg-surface text-content" onChange={(event) => setLotId(event.target.value)} required={mode !== 'entry'} value={lotId}>
              <option value="">{mode === 'entry' ? 'Crear un lote nuevo' : 'Seleccioná un lote'}</option>
              {mode === 'entry' && <option value="new">Crear un lote nuevo</option>}
              {product?.lots.map((lot) => <option disabled={lot.isExpired} key={lot.id} value={lot.id}>{lot.code} · vence {lot.expirationDate.slice(0, 10)} · {lot.quantity} unidades{lot.isExpired ? ' · Vencido' : ''}</option>)}
            </select>
          </label>
        )}

        {requiresNewLot && (
          <>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Código de lote</span>
              <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setLotCode(event.target.value)} required value={lotCode} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-content">Vencimiento</span>
              <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setExpirationDate(event.target.value)} required type="date" value={expirationDate} />
            </label>
          </>
        )}

        {mode === 'physicalCount' ? (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-content">Cantidad contada</span>
            <input className="input input-bordered h-12 w-full bg-surface text-content" min="0" onChange={(event) => setCountedQuantity(event.target.value)} required type="number" value={countedQuantity} />
          </label>
        ) : (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-content">Cantidad</span>
            <input className="input input-bordered h-12 w-full bg-surface text-content" min="1" onChange={(event) => setQuantity(event.target.value)} required type="number" value={quantity} />
          </label>
        )}

        {mode !== 'physicalCount' && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-content">Motivo</span>
            <select className="select select-bordered h-12 w-full bg-surface text-content" onChange={(event) => setReason(event.target.value as typeof reason)} value={reason}>
              {mode === 'entry' ? <><option value="purchase">Compra</option><option value="donation">Donación</option><option value="adjustment">Ajuste manual</option></> : exitReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}

        <label className="space-y-2">
          <span className="text-sm font-semibold text-content">Fecha operativa</span>
          <input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setOperationalDate(event.target.value)} required type="date" value={operationalDate} />
        </label>
        {mode === 'entry' && <label className="space-y-2"><span className="text-sm font-semibold text-content">Origen opcional</span><input className="input input-bordered h-12 w-full bg-surface text-content" onChange={(event) => setSource(event.target.value)} value={source} /></label>}
        <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-content">Observación</span><textarea className="textarea textarea-bordered min-h-24 w-full bg-surface text-content" onChange={(event) => setObservation(event.target.value)} value={observation} /></label>
      </div>

      {error && <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className="btn btn-ghost" onClick={onCancel} type="button">Cancelar</button><button className="btn btn-primary" disabled={isSubmitting || usableProducts.length === 0} type="submit">{isSubmitting ? 'Guardando…' : 'Confirmar operación'}</button></div>
    </form>
  )
}
