'use client'

import {
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import {
  buildContribuyenteSearchParams,
  formatContribuyenteNombre,
  type Contribuyente,
} from '@/lib/contribuyente-map'

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const value = payload as { error?: { message?: unknown }; errors?: { message?: unknown }[] }
  const message = value.error?.message ?? value.errors?.[0]?.message
  return typeof message === 'string' ? message : fallback
}

type MemberView = {
  member: { id: string; contributorId: string; isReferent: boolean; status: string }
  contributor?: Contribuyente | null
}

type GroupView = {
  group: { id: string; status: string; referenteContributorId: string; observations?: string | null }
  members: MemberView[]
  referente?: Contribuyente | null
}

type ProposalLot = { id: string; code: string; expirationDate: string; quantity: number }

type ProposalLine = {
  productId: string
  productName: string
  quantity: number
  bundleVersionId?: string
  tracksLotExpiration: boolean
  availableQuantity: number
  lots: ProposalLot[]
}

type EditableLine = ProposalLine & { lotId: string; observation: string }

type DeliveryListItem = {
  delivery: {
    id: string
    deliveryDate: string
    confirmedAt: string
    receiverContributorId: string
    receiverIsThirdParty: boolean
    observations?: string | null
    group: string | { id: string; referenteContributorId: string }
  }
  bundleCount: number
  lineCount: number
  totalUnits: number
}

type BundleVersionOption = {
  id: string
  bundleName: string
  version: number
  lines: { productId: string; quantity: number; productName: string }[]
}

type ProductOption = { id: string; name: string; tracksLotExpiration: boolean }

type View = 'list' | 'detail' | 'create'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function EntregasWorkspace() {
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (view === 'create') {
    return (
      <CreateDeliveryPanel
        onBack={() => setView('list')}
        onCreated={(id) => { setSelectedId(id); setView('detail') }}
      />
    )
  }

  if (view === 'detail' && selectedId) {
    return <DeliveryDetailPanel deliveryId={selectedId} onBack={() => setView('list')} />
  }

  return (
    <DeliveriesListPanel
      onCreate={() => setView('create')}
      onOpen={(id) => { setSelectedId(id); setView('detail') }}
    />
  )
}

function DeliveriesListPanel({ onCreate, onOpen }: { onCreate: () => void; onOpen: (id: string) => void }) {
  const [docs, setDocs] = useState<DeliveryListItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setRefreshing(true)
      setError('')
      try {
        const response = await fetch(`/api/entregas?page=${page}&limit=15`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, 'No se pudieron cargar las entregas.'))
        setDocs(Array.isArray(payload?.docs) ? payload.docs : [])
        setTotalDocs(typeof payload?.totalDocs === 'number' ? payload.totalDocs : 0)
        setTotalPages(Math.max(1, typeof payload?.totalPages === 'number' ? payload.totalPages : 1))
      } catch (value) {
        if (value instanceof Error && value.name !== 'AbortError') setError(value.message)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [page, refreshKey])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Acción social</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Entregas</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-content-muted">
            Asistencia confirmada a grupos familiares con salida real de stock.
          </p>
        </div>
        <button className="btn btn-primary min-h-11 gap-2 self-start sm:self-auto" onClick={onCreate} type="button">
          <IconPlus aria-hidden="true" size={18} />
          Nueva entrega
        </button>
      </div>

      <section aria-label="Listado de entregas" className="mt-7">
        <div className="flex justify-end">
          <button
            aria-label="Actualizar listado"
            className="btn btn-ghost min-h-11 gap-2"
            disabled={refreshing}
            onClick={() => setRefreshKey((value) => value + 1)}
            type="button"
          >
            <IconRefresh aria-hidden="true" className={refreshing ? 'animate-spin' : ''} size={18} />
            Actualizar
          </button>
        </div>

        {error && <div className="alert alert-error mt-4" role="alert"><span>{error}</span></div>}

        <div className="mt-4 overflow-x-auto rounded-box border border-line bg-surface shadow-sm">
          {loading ? (
            <div aria-label="Cargando entregas" aria-live="polite" className="flex min-h-64 items-center justify-center">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <table className="table table-zebra">
              <caption className="sr-only">Listado de entregas confirmadas</caption>
              <thead>
                <tr>
                  <th>Fecha entrega</th>
                  <th>Grupo</th>
                  <th>Líneas</th>
                  <th>Unidades</th>
                  <th>Confirmada</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td className="py-12 text-center text-content-muted" colSpan={6}>
                      Todavía no hay entregas confirmadas.
                    </td>
                  </tr>
                ) : (
                  docs.map((item) => (
                    <tr key={item.delivery.id}>
                      <td className="font-semibold">{item.delivery.deliveryDate}</td>
                      <td className="max-w-56 truncate">
                        {typeof item.delivery.group === 'object'
                          ? item.delivery.group.referenteContributorId
                          : item.delivery.group}
                      </td>
                      <td>{item.lineCount}</td>
                      <td>{item.totalUnits}</td>
                      <td>{new Date(item.delivery.confirmedAt).toLocaleString('es-AR')}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => onOpen(item.delivery.id)} type="button">
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!loading && totalDocs > 0 && (
          <div className="flex items-center justify-between py-4 text-sm text-content-muted">
            <span>{totalDocs.toLocaleString('es-AR')} entregas</span>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)} type="button">
                Anterior
              </button>
              <span aria-live="polite">{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((v) => v + 1)} type="button">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function DeliveryDetailPanel({ deliveryId, onBack }: { deliveryId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<DeliveryListItem | null>(null)
  const [group, setGroup] = useState<GroupView | null>(null)
  const [receiver, setReceiver] = useState<Contribuyente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/entregas/${deliveryId}`, { credentials: 'include' })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo cargar la entrega.'))
        if (cancelled) return
        setDetail(payload.doc)

        const groupId =
          typeof payload.doc.delivery.group === 'object'
            ? payload.doc.delivery.group.id
            : payload.doc.delivery.group
        const [groupResponse, receiverResponse] = await Promise.all([
          fetch(`/api/grupos/${groupId}`, { credentials: 'include' }),
          fetch(`/api/contribuyentes/${payload.doc.delivery.receiverContributorId}`, { credentials: 'include' }),
        ])
        if (cancelled) return
        const groupPayload = await groupResponse.json().catch(() => null)
        if (groupResponse.ok) setGroup(groupPayload.doc)
        const receiverPayload = await receiverResponse.json().catch(() => null)
        if (receiverResponse.ok) setReceiver(receiverPayload.doc ?? receiverPayload)
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : 'No se pudo cargar la entrega.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [deliveryId])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-96 w-full max-w-7xl items-center justify-center px-4">
        <span className="loading loading-spinner loading-lg text-primary" />
      </main>
    )
  }

  if (!detail) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="alert alert-error" role="alert"><span>{error || 'Entrega no encontrada.'}</span></div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <button className="btn btn-ghost mb-4 gap-2" onClick={onBack} type="button">
        <IconArrowLeft aria-hidden="true" size={18} />
        Volver al listado
      </button>

      <div className="border-b border-line pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Entrega confirmada</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-content">
          Entrega del {detail.delivery.deliveryDate}
        </h1>
        <p className="mt-2 text-sm text-content-muted">
          {detail.lineCount} líneas · {detail.totalUnits} unidades · {detail.bundleCount} bolsones
        </p>
      </div>

      {error && <div className="alert alert-error mt-4" role="alert"><span>{error}</span></div>}

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <article className="rounded-box border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-content">Grupo destinatario</h2>
          <p className="mt-2 text-sm text-content-muted">
            {group?.referente ? formatContribuyenteNombre(group.referente.nombre) : 'Cargando grupo…'}
          </p>
          {group?.referente?.barrio && (
            <p className="text-sm text-content-muted">Barrio {group.referente.barrio}</p>
          )}
        </article>
        <article className="rounded-box border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-content">Receptor</h2>
          <p className="mt-2 text-sm text-content-muted">
            {receiver ? formatContribuyenteNombre(receiver.nombre) : detail.delivery.receiverContributorId}
          </p>
          {detail.delivery.receiverIsThirdParty && (
            <span className="badge badge-warning mt-2">Tercero autorizado</span>
          )}
        </article>
        <article className="rounded-box border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-content">Confirmación</h2>
          <p className="mt-2 text-sm text-content-muted">
            {new Date(detail.delivery.confirmedAt).toLocaleString('es-AR')}
          </p>
          {detail.delivery.observations && (
            <p className="mt-2 text-sm text-content-muted">{detail.delivery.observations}</p>
          )}
        </article>
      </section>
    </main>
  )
}

function CreateDeliveryPanel({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(1)
  const [group, setGroup] = useState<GroupView | null>(null)
  const [receiverId, setReceiverId] = useState('')
  const [receiverIsThirdParty, setReceiverIsThirdParty] = useState(false)
  const [receiverReason, setReceiverReason] = useState('')
  const [thirdParty, setThirdParty] = useState<Contribuyente | null>(null)
  const [bundleVersions, setBundleVersions] = useState<BundleVersionOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedBundles, setSelectedBundles] = useState<{ bundleVersionId: string; quantity: number }[]>([])
  const [selectedLoose, setSelectedLoose] = useState<{ productId: string; quantity: number }[]>([])
  const [lines, setLines] = useState<EditableLine[]>([])
  const [linesDirty, setLinesDirty] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState(todayKey())
  const [observations, setObservations] = useState('')
  const [recipeDiffReason, setRecipeDiffReason] = useState('')
  const [loadingProposal, setLoadingProposal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function loadCatalog() {
      try {
        const response = await fetch('/api/entregas/catalogo', {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo cargar el catálogo de la entrega.'))
        if (controller.signal.aborted) return
        setBundleVersions(Array.isArray(payload?.bundleVersions) ? payload.bundleVersions : [])
        setProducts(Array.isArray(payload?.products) ? payload.products : [])
      } catch (value) {
        if (value instanceof Error && value.name !== 'AbortError') {
          setError(value.message)
        }
      }
    }
    void loadCatalog()
    return () => controller.abort()
  }, [])

  async function loadProposal() {
    setLoadingProposal(true)
    setError('')
    try {
      const response = await fetch('/api/entregas/propuesta', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundles: selectedBundles, looseProducts: selectedLoose }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo armar la propuesta.'))
      setLines(
        (payload.lines as ProposalLine[]).map((line) => ({ ...line, lotId: '', observation: '' })),
      )
      setLinesDirty(false)
      setStep(4)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo armar la propuesta.')
    } finally {
      setLoadingProposal(false)
    }
  }

  async function confirm() {
    if (!group) return
    if (!receiverId) {
      setError('Elegí quién retira la entrega.')
      return
    }
    if (receiverIsThirdParty && !receiverReason.trim()) {
      setError('Indicá la autorización y el motivo del receptor tercero.')
      return
    }
    if (linesDirty && !recipeDiffReason.trim()) {
      setError('Indicar el motivo porque las líneas reales difieren de la receta.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/entregas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.group.id,
          receiverContributorId: receiverId,
          receiverIsThirdParty,
          receiverAuthorizationReason: receiverReason.trim() || undefined,
          deliveryDate,
          observations: observations.trim() || undefined,
          recipeDiffReason: recipeDiffReason.trim() || undefined,
          bundles: selectedBundles,
          lines: lines.map((line) => ({
            productId: line.productId,
            lotId: line.lotId || undefined,
            quantity: line.quantity,
            bundleVersionId: line.bundleVersionId,
            observation: line.observation.trim() || undefined,
          })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo confirmar la entrega.'))
      onCreated(payload.doc.delivery.id)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo confirmar la entrega.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <button className="btn btn-ghost mb-4 gap-2" onClick={onBack} type="button">
        <IconArrowLeft aria-hidden="true" size={18} />
        Volver al listado
      </button>

      <div className="border-b border-line pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Nueva entrega · paso {step} de 4</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Entregar a un grupo</h1>
      </div>

      {error && <div className="alert alert-error mt-4" role="alert"><span>{error}</span></div>}

      {step === 1 && (
        <GroupPicker
          onClear={() => setGroup(null)}
          onNext={() => setStep(2)}
          onSelect={(selected) => {
            setGroup(selected)
            const referent = selected.members.find((item) => item.member.isReferent && item.member.status === 'active')
            setReceiverId(referent?.member.contributorId ?? '')
            setReceiverIsThirdParty(false)
            setThirdParty(null)
          }}
          selected={group}
        />
      )}

      {step === 2 && group && (
        <ReceiverPicker
          group={group}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          receiverId={receiverId}
          receiverIsThirdParty={receiverIsThirdParty}
          receiverReason={receiverReason}
          setReceiverId={setReceiverId}
          setReceiverIsThirdParty={setReceiverIsThirdParty}
          setReceiverReason={setReceiverReason}
          setThirdParty={setThirdParty}
          thirdParty={thirdParty}
        />
      )}

      {step === 3 && (
        <ContentPicker
          bundleVersions={bundleVersions}
          loadingProposal={loadingProposal}
          onBack={() => setStep(2)}
          onPropose={() => void loadProposal()}
          products={products}
          selectedBundles={selectedBundles}
          selectedLoose={selectedLoose}
          setSelectedBundles={setSelectedBundles}
          setSelectedLoose={setSelectedLoose}
        />
      )}

      {step === 4 && (
        <RealLinesReview
          deliveryDate={deliveryDate}
          lines={lines}
          linesDirty={linesDirty}
          observations={observations}
          onBack={() => setStep(3)}
          onConfirm={() => void confirm()}
          recipeDiffReason={recipeDiffReason}
          saving={saving}
          setDeliveryDate={setDeliveryDate}
          setLines={(next) => { setLines(next); setLinesDirty(true) }}
          setObservations={setObservations}
          setRecipeDiffReason={setRecipeDiffReason}
        />
      )}
    </main>
  )
}

function GroupPicker({
  onClear,
  onNext,
  onSelect,
  selected,
}: {
  onClear: () => void
  onNext: () => void
  onSelect: (group: GroupView) => void
  selected: GroupView | null
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<GroupView[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!search.trim()) {
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ search: search.trim(), status: 'active', limit: '8' })
        const response = await fetch(`/api/grupos?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (response.ok) setResults(Array.isArray(payload?.docs) ? payload.docs : [])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const visibleResults = useMemo(() => (search.trim() ? results : []), [results, search])

  return (
    <section className="mt-8 rounded-box border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold text-content">1. Grupo destinatario</h2>
      <p className="mt-1 text-sm text-content-muted">Buscá un grupo activo por su referente.</p>
      {selected ? (
        <div className="mt-4 rounded-box border border-line bg-page p-4">
          <p className="font-semibold text-content">
            {selected.referente ? formatContribuyenteNombre(selected.referente.nombre) : selected.group.referenteContributorId}
          </p>
          <p className="text-sm text-content-muted">
            {selected.members.filter((item) => item.member.status === 'active').length} integrantes activos
          </p>
          <button className="btn btn-ghost btn-sm mt-2" onClick={onClear} type="button">
            Cambiar grupo
          </button>
        </div>
      ) : null}
      <label className="input input-bordered mt-4 flex min-h-11 items-center gap-2 bg-page text-content">
        <IconSearch aria-hidden="true" className="text-content-muted" size={18} />
        <input
          aria-label="Buscar grupo"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Referente por nombre o DNI"
          value={search}
        />
      </label>
      {loading && <p className="mt-2 text-sm text-content-muted">Buscando…</p>}
      {visibleResults.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visibleResults.map((item) => (
            <li key={item.group.id}>
              <button
                className="flex w-full items-center justify-between rounded-box border border-line bg-page px-4 py-3 text-left hover:border-primary"
                onClick={() => { onSelect(item); setSearch('') }}
                type="button"
              >
                <span>
                  <span className="block font-semibold text-content">
                    {item.referente ? formatContribuyenteNombre(item.referente.nombre) : item.group.referenteContributorId}
                  </span>
                  <span className="text-sm text-content-muted">
                    {item.members.filter((member) => member.member.status === 'active').length} integrantes
                  </span>
                </span>
                <IconArrowRight aria-hidden="true" className="text-primary" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" disabled={!selected} onClick={onNext} type="button">
          Continuar
        </button>
      </div>
    </section>
  )
}

function ReceiverPicker(props: {
  group: GroupView
  onBack: () => void
  onNext: () => void
  receiverId: string
  receiverIsThirdParty: boolean
  receiverReason: string
  setReceiverId: (value: string) => void
  setReceiverIsThirdParty: (value: boolean) => void
  setReceiverReason: (value: string) => void
  setThirdParty: (value: Contribuyente | null) => void
  thirdParty: Contribuyente | null
}) {
  const { group } = props
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Contribuyente[]>([])
  const activeMembers = group.members.filter((item) => item.member.status === 'active')

  useEffect(() => {
    if (!search.trim() || !props.receiverIsThirdParty) {
      return
    }
    const timer = window.setTimeout(async () => {
      const params = buildContribuyenteSearchParams(search, 8)
      const response = await fetch(`/api/contribuyentes?${params.toString()}`, { credentials: 'include' })
      const payload = await response.json().catch(() => null)
      if (response.ok) setResults(Array.isArray(payload?.docs) ? payload.docs : [])
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search, props.receiverIsThirdParty])

  const visibleResults = search.trim() ? results : []

  return (
    <section className="mt-8 rounded-box border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold text-content">2. Quién retira</h2>
      <p className="mt-1 text-sm text-content-muted">Un integrante del grupo o un tercero contribuyente autorizado.</p>

      <div className="mt-4 space-y-2">
        {activeMembers.map((item) => (
          <label className="flex cursor-pointer items-center gap-3 rounded-box border border-line bg-page px-4 py-3" key={item.member.id}>
            <input
              checked={!props.receiverIsThirdParty && props.receiverId === item.member.contributorId}
              className="radio radio-primary"
              name="receiver"
              onChange={() => {
                props.setReceiverIsThirdParty(false)
                props.setReceiverId(item.member.contributorId)
              }}
              type="radio"
            />
            <span>
              <span className="block font-semibold text-content">
                {item.contributor ? formatContribuyenteNombre(item.contributor.nombre) : item.member.contributorId}
              </span>
              <span className="text-sm text-content-muted">
                {item.member.isReferent ? 'Referente' : 'Integrante'}
              </span>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-3 rounded-box border border-line bg-page px-4 py-3">
          <input
            checked={props.receiverIsThirdParty}
            className="radio radio-primary"
            name="receiver"
            onChange={() => props.setReceiverIsThirdParty(true)}
            type="radio"
          />
          <span className="font-semibold text-content">Tercero autorizado</span>
        </label>
      </div>

      {props.receiverIsThirdParty && (
        <div className="mt-4">
          {props.thirdParty ? (
            <div className="rounded-box border border-line bg-page p-4">
              <p className="font-semibold">{formatContribuyenteNombre(props.thirdParty.nombre)}</p>
              <p className="text-sm text-content-muted">DNI {props.thirdParty.numero_documento ?? '—'}</p>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => props.setThirdParty(null)} type="button">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <label className="input input-bordered flex min-h-11 items-center gap-2 bg-page text-content">
                <IconSearch aria-hidden="true" className="text-content-muted" size={18} />
                <input
                  aria-label="Buscar tercero en el padrón"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre o DNI del tercero"
                  value={search}
                />
              </label>
              {visibleResults.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {visibleResults.map((contributor) => (
                    <li key={contributor.id}>
                      <button
                        className="w-full rounded-box border border-line bg-page px-4 py-3 text-left hover:border-primary"
                        onClick={() => { props.setThirdParty(contributor); props.setReceiverId(contributor.id); setSearch('') }}
                        type="button"
                      >
                        <span className="block font-semibold">{formatContribuyenteNombre(contributor.nombre)}</span>
                        <span className="text-sm text-content-muted">DNI {contributor.numero_documento ?? '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <label className="form-control mt-4 gap-1">
            <span className="label-text font-semibold">Autorización y motivo</span>
            <textarea
              className="textarea textarea-bordered bg-page"
              onChange={(event) => props.setReceiverReason(event.target.value)}
              value={props.receiverReason}
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button className="btn btn-ghost" onClick={props.onBack} type="button">Atrás</button>
        <button
          className="btn btn-primary"
          disabled={!props.receiverIsThirdParty && !props.receiverId}
          onClick={props.onNext}
          type="button"
        >
          Continuar
        </button>
      </div>
    </section>
  )
}

function ContentPicker(props: {
  bundleVersions: BundleVersionOption[]
  loadingProposal: boolean
  onBack: () => void
  onPropose: () => void
  products: ProductOption[]
  selectedBundles: { bundleVersionId: string; quantity: number }[]
  selectedLoose: { productId: string; quantity: number }[]
  setSelectedBundles: (value: { bundleVersionId: string; quantity: number }[]) => void
  setSelectedLoose: (value: { productId: string; quantity: number }[]) => void
}) {
  const [bundleId, setBundleId] = useState(props.bundleVersions[0]?.id ?? '')
  const [bundleQty, setBundleQty] = useState(1)
  const [productId, setProductId] = useState(props.products[0]?.id ?? '')
  const [productQty, setProductQty] = useState(1)

  useEffect(() => {
    if (!props.bundleVersions.some((item) => item.id === bundleId)) {
      setBundleId(props.bundleVersions[0]?.id ?? '')
    }
  }, [bundleId, props.bundleVersions])

  useEffect(() => {
    if (!props.products.some((item) => item.id === productId)) {
      setProductId(props.products[0]?.id ?? '')
    }
  }, [productId, props.products])

  const canPropose = props.selectedBundles.length > 0 || props.selectedLoose.length > 0

  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-2">
      <article className="rounded-box border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-bold text-content">Bolsones</h2>
        {props.bundleVersions.length === 0 ? (
          <p className="mt-2 text-sm text-content-muted">No hay versiones vigentes de bolsones.</p>
        ) : (
          <>
            <label className="form-control mt-3 gap-1">
              <span className="label-text font-semibold">Bolsón vigente</span>
              <select className="select select-bordered bg-page" onChange={(event) => setBundleId(event.target.value)} value={bundleId}>
                {props.bundleVersions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.bundleName} v{item.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control mt-3 gap-1">
              <span className="label-text font-semibold">Cantidad</span>
              <input
                className="input input-bordered bg-page"
                min={1}
                onChange={(event) => setBundleQty(Math.max(1, Number(event.target.value) || 1))}
                type="number"
                value={bundleQty}
              />
            </label>
            <button
              className="btn btn-outline btn-sm mt-3"
              onClick={() => {
                if (!bundleId) return
                props.setSelectedBundles(
                  props.selectedBundles.some((item) => item.bundleVersionId === bundleId)
                    ? props.selectedBundles
                    : [...props.selectedBundles, { bundleVersionId: bundleId, quantity: bundleQty }],
                )
              }}
              type="button"
            >
              Agregar bolsón
            </button>
          </>
        )}
        {props.selectedBundles.length > 0 && (
          <ul className="mt-3 space-y-2">
            {props.selectedBundles.map((item) => {
              const option = props.bundleVersions.find((bundle) => bundle.id === item.bundleVersionId)
              return (
                <li className="flex items-center justify-between rounded-box border border-line bg-page px-4 py-2 text-sm" key={item.bundleVersionId}>
                  <span>{option ? `${option.bundleName} v${option.version}` : item.bundleVersionId} × {item.quantity}</span>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => props.setSelectedBundles(props.selectedBundles.filter((entry) => entry.bundleVersionId !== item.bundleVersionId))}
                    type="button"
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <article className="rounded-box border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-bold text-content">Productos sueltos</h2>
        {props.products.length === 0 ? (
          <p className="mt-2 text-sm text-content-muted">No hay productos activos.</p>
        ) : (
          <>
            <label className="form-control mt-3 gap-1">
              <span className="label-text font-semibold">Producto</span>
              <select className="select select-bordered bg-page" onChange={(event) => setProductId(event.target.value)} value={productId}>
                {props.products.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="form-control mt-3 gap-1">
              <span className="label-text font-semibold">Cantidad</span>
              <input
                className="input input-bordered bg-page"
                min={1}
                onChange={(event) => setProductQty(Math.max(1, Number(event.target.value) || 1))}
                type="number"
                value={productQty}
              />
            </label>
            <button
              className="btn btn-outline btn-sm mt-3"
              onClick={() => {
                if (!productId) return
                props.setSelectedLoose(
                  props.selectedLoose.some((item) => item.productId === productId)
                    ? props.selectedLoose
                    : [...props.selectedLoose, { productId, quantity: productQty }],
                )
              }}
              type="button"
            >
              Agregar producto
            </button>
          </>
        )}
        {props.selectedLoose.length > 0 && (
          <ul className="mt-3 space-y-2">
            {props.selectedLoose.map((item) => {
              const option = props.products.find((product) => product.id === item.productId)
              return (
                <li className="flex items-center justify-between rounded-box border border-line bg-page px-4 py-2 text-sm" key={item.productId}>
                  <span>{option?.name ?? item.productId} × {item.quantity}</span>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => props.setSelectedLoose(props.selectedLoose.filter((entry) => entry.productId !== item.productId))}
                    type="button"
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <div className="flex justify-between lg:col-span-2">
        <button className="btn btn-ghost" onClick={props.onBack} type="button">Atrás</button>
        <button className="btn btn-primary" disabled={!canPropose || props.loadingProposal} onClick={props.onPropose} type="button">
          {props.loadingProposal ? 'Armando…' : 'Ver propuesta'}
        </button>
      </div>
    </section>
  )
}

function RealLinesReview(props: {  deliveryDate: string
  lines: EditableLine[]
  linesDirty: boolean
  observations: string
  onBack: () => void
  onConfirm: () => void
  recipeDiffReason: string
  saving: boolean
  setDeliveryDate: (value: string) => void
  setLines: (value: EditableLine[]) => void
  setObservations: (value: string) => void
  setRecipeDiffReason: (value: string) => void
}) {
  return (
    <section className="mt-8 rounded-box border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold text-content">4. Líneas reales y confirmación</h2>
      <p className="mt-1 text-sm text-content-muted">
        Ajustá cantidades y, si querés, elegí el lote. Solo se descuenta lo que confirmes acá.
      </p>

      <div className="mt-4 overflow-x-auto rounded-box border border-line">
        <table className="table table-zebra">
          <caption className="sr-only">Líneas reales de la entrega</caption>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Disponible</th>
              <th>Cantidad real</th>
              <th>Lote</th>
            </tr>
          </thead>
          <tbody>
            {props.lines.map((line, index) => (
              <tr key={`${line.productId}-${line.lotId}-${line.bundleVersionId ?? 'suelto'}-${index}`}>
                <td className="font-semibold">{line.productName}</td>
                <td>{line.availableQuantity}</td>
                <td>
                  <input
                    aria-label={`Cantidad real de ${line.productName}`}
                    className={`input input-bordered input-sm w-24 ${line.quantity > line.availableQuantity ? 'input-error' : ''}`}
                    min={1}
                    onChange={(event) => {
                      const quantity = Math.max(1, Number(event.target.value) || 1)
                      props.setLines(props.lines.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity } : entry))
                    }}
                    type="number"
                    value={line.quantity}
                  />
                  {line.quantity > line.availableQuantity && (
                    <span className="block text-xs text-error">Supera el stock disponible</span>
                  )}
                </td>
                <td>
                  {line.tracksLotExpiration ? (
                    <select
                      aria-label={`Lote de ${line.productName}`}
                      className="select select-bordered select-sm max-w-48"
                      onChange={(event) => {
                        const lotId = event.target.value
                        props.setLines(props.lines.map((entry, entryIndex) => entryIndex === index ? { ...entry, lotId } : entry))
                      }}
                      value={line.lotId}
                    >
                      <option value="">Sin especificar (opcional)</option>
                      {line.lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.code} · vto {lot.expirationDate.slice(0, 10)} · {lot.quantity}u
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-content-muted">Sin lote</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="form-control gap-1">
          <span className="label-text font-semibold">Fecha de entrega</span>
          <input
            className="input input-bordered bg-page"
            onChange={(event) => props.setDeliveryDate(event.target.value)}
            type="date"
            value={props.deliveryDate}
          />
        </label>
        <label className="form-control gap-1">
          <span className="label-text font-semibold">
            Motivo de diferencia con la receta {props.linesDirty ? '' : '(opcional)'}
          </span>
          <input
            className="input input-bordered bg-page"
            onChange={(event) => props.setRecipeDiffReason(event.target.value)}
            placeholder="Ej. faltó stock de un producto"
            value={props.recipeDiffReason}
          />
        </label>
      </div>
      <label className="form-control mt-4 gap-1">
        <span className="label-text font-semibold">Observaciones</span>
        <textarea
          className="textarea textarea-bordered bg-page"
          onChange={(event) => props.setObservations(event.target.value)}
          value={props.observations}
        />
      </label>

      <div className="mt-4 flex justify-between">
        <button className="btn btn-ghost" onClick={props.onBack} type="button">Atrás</button>
        <button className="btn btn-primary" disabled={props.saving} onClick={props.onConfirm} type="button">
          {props.saving ? 'Confirmando…' : 'Confirmar entrega'}
        </button>
      </div>
    </section>
  )
}
