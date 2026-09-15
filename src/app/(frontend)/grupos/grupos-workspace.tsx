'use client'

import {
  IconArrowLeft,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUserPlus,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Role } from '@/access/roles'
import {
  buildContribuyenteSearchParams,
  formatContribuyenteNombre,
  type Contribuyente,
} from '@/lib/contribuyente-map'

import { ContribuyentesWorkspace } from './contribuyentes-workspace'
import type { DraftMember, ExistingMembership, FamilyGroupView, KinshipOption } from './group-ui-types'

type Tab = 'grupos' | 'contribuyentes'
type View = 'list' | 'detail' | 'create'

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const value = payload as { error?: { message?: unknown }; errors?: { message?: unknown }[] }
  const message = value.error?.message ?? value.errors?.[0]?.message
  return typeof message === 'string' ? message : fallback
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`btn min-h-11 ${active ? 'btn-primary' : 'btn-ghost'}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

export function GruposWorkspace({ roles }: { roles: readonly Role[] }) {
  const [tab, setTab] = useState<Tab>('grupos')

  if (tab === 'contribuyentes') {
    return (
      <div>
        <ModuleTabs active={tab} onChange={setTab} />
        <ContribuyentesWorkspace embedded roles={roles} />
      </div>
    )
  }

  return (
    <div>
      <ModuleTabs active={tab} onChange={setTab} />
      <GroupsPanel roles={roles} />
    </div>
  )
}

function ModuleTabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 py-3 sm:px-6 lg:px-10">
        <TabButton active={active === 'grupos'} label="Grupos familiares" onClick={() => onChange('grupos')} />
        <TabButton active={active === 'contribuyentes'} label="Contribuyentes" onClick={() => onChange('contribuyentes')} />
      </div>
    </div>
  )
}

function GroupsPanel({ roles }: { roles: readonly Role[] }) {
  const canEdit = roles.includes('admin') || roles.includes('administracion')
  const [view, setView] = useState<View>('list')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  if (view === 'create') {
    return <CreateGroupPanel canEdit={canEdit} onBack={() => setView('list')} onCreated={(groupId) => { setSelectedGroupId(groupId); setView('detail') }} />
  }

  if (view === 'detail' && selectedGroupId) {
    return (
      <GroupDetailPanel
        canEdit={canEdit}
        groupId={selectedGroupId}
        onBack={() => setView('list')}
      />
    )
  }

  return (
    <GroupsListPanel
      canEdit={canEdit}
      onCreate={() => setView('create')}
      onOpen={(groupId) => { setSelectedGroupId(groupId); setView('detail') }}
    />
  )
}

function GroupsListPanel({
  canEdit,
  onCreate,
  onOpen,
}: {
  canEdit: boolean
  onCreate: () => void
  onOpen: (groupId: string) => void
}) {
  const [groups, setGroups] = useState<FamilyGroupView[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    params.set('status', status)
    if (search.trim()) params.set('search', search.trim())
    return params
  }, [limit, page, search, status])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setRefreshing(true)
      setError('')
      try {
        const response = await fetch(`/api/grupos?${query.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, 'No se pudieron cargar los grupos.'))
        setGroups(Array.isArray(payload?.docs) ? payload.docs : [])
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
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, refreshKey])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Acción social</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Grupos familiares</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-content-muted">
            Armá grupos a partir del padrón municipal para asignarles asistencia más adelante.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary min-h-11 gap-2 self-start sm:self-auto" onClick={onCreate} type="button">
            <IconPlus aria-hidden="true" size={18} />
            Nuevo grupo
          </button>
        )}
      </div>

      <section aria-label="Listado de grupos familiares" className="mt-7">
        <div className="flex flex-col gap-3 rounded-box border border-line bg-surface p-4 shadow-sm lg:flex-row lg:items-center">
          <label className="input input-bordered flex min-h-11 flex-1 items-center gap-2 bg-page text-content">
            <IconSearch aria-hidden="true" className="text-content-muted" size={18} />
            <span className="sr-only">Buscar grupos</span>
            <input
              aria-label="Buscar por referente"
              onChange={(event) => { setPage(1); setSearch(event.target.value) }}
              placeholder="Referente por nombre o DNI"
              value={search}
            />
          </label>
          <select
            aria-label="Estado del grupo"
            className="select select-bordered min-h-11 bg-page text-content"
            onChange={(event) => { setPage(1); setStatus(event.target.value as 'active' | 'inactive' | 'all') }}
            value={status}
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
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
            <div aria-label="Cargando grupos" aria-live="polite" className="flex min-h-64 items-center justify-center">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <table className="table table-zebra">
              <caption className="sr-only">Listado de grupos familiares</caption>
              <thead>
                <tr>
                  <th>Referente</th>
                  <th>DNI</th>
                  <th>Barrio</th>
                  <th>Integrantes</th>
                  <th>Estado</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td className="py-12 text-center text-content-muted" colSpan={6}>
                      No se encontraron grupos.
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => {
                    const activeMembers = group.members.filter((item) => item.member.status === 'active').length
                    return (
                      <tr key={group.group.id}>
                        <td className="font-semibold">
                          {group.referente
                            ? formatContribuyenteNombre(group.referente.nombre)
                            : group.group.referenteContributorId}
                        </td>
                        <td>{group.referente?.numero_documento ?? '—'}</td>
                        <td>{group.referente?.barrio || '—'}</td>
                        <td>{activeMembers}</td>
                        <td>
                          <span className={`badge ${group.group.status === 'active' ? 'badge-success' : 'badge-ghost'}`}>
                            {group.group.status === 'active' ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => onOpen(group.group.id)} type="button">
                            Ver ficha
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {!loading && totalDocs > 0 && (
          <div className="flex flex-col gap-3 py-4 text-sm text-content-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {((page - 1) * limit) + 1}–{Math.min(page * limit, totalDocs)} de {totalDocs.toLocaleString('es-AR')}
            </span>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1 || refreshing} onClick={() => setPage((value) => value - 1)} type="button">
                Anterior
              </button>
              <span aria-live="polite">{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages || refreshing} onClick={() => setPage((value) => value + 1)} type="button">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function CreateGroupPanel({
  canEdit,
  onBack,
  onCreated,
}: {
  canEdit: boolean
  onBack: () => void
  onCreated: (groupId: string) => void
}) {
  const [kinships, setKinships] = useState<KinshipOption[]>([])
  const [referente, setReferente] = useState<Contribuyente | null>(null)
  const [members, setMembers] = useState<DraftMember[]>([])
  const [observations, setObservations] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Contribuyente[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const nonReferenteKinships = useMemo(
    () => kinships.filter((item) => item.code !== 'referente'),
    [kinships],
  )

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/parentescos', { credentials: 'include' })
      const payload = await response.json().catch(() => null)
      if (response.ok && Array.isArray(payload?.docs)) {
        setKinships(payload.docs.map((item: KinshipOption) => ({
          id: item.id,
          label: item.label,
          code: item.code,
          requiresObservation: Boolean(item.requiresObservation),
        })))
      }
    })()
  }, [])

  const visibleResults = search.trim() ? results : []

  useEffect(() => {
    if (!search.trim()) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingSearch(true)
      try {
        const params = buildContribuyenteSearchParams(search, 8)
        const response = await fetch(`/api/contribuyentes?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo buscar en el padrón.'))
        if (!controller.signal.aborted) {
          setResults(Array.isArray(payload?.docs) ? payload.docs : [])
        }
      } catch (value) {
        if (value instanceof Error && value.name !== 'AbortError') setError(value.message)
      } finally {
        if (!controller.signal.aborted) setLoadingSearch(false)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const checkMemberships = useCallback(async (contributorId: string): Promise<ExistingMembership[]> => {
    const response = await fetch(`/api/grupos/membresias?contributorId=${encodeURIComponent(contributorId)}`, {
      credentials: 'include',
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(errorMessage(payload, 'No se pudieron verificar membresías.'))
    return Array.isArray(payload?.memberships) ? payload.memberships : []
  }, [])

  async function selectReferente(contributor: Contribuyente) {
    setError('')
    setReferente(contributor)
    setSearch('')
    setResults([])
  }

  async function addMember(contributor: Contribuyente) {
    if (!nonReferenteKinships[0]) return
    if (referente?.id === contributor.id) {
      setError('El referente ya forma parte del grupo.')
      return
    }
    if (members.some((item) => item.contributor.id === contributor.id)) {
      setError('Ese integrante ya fue agregado.')
      return
    }
    try {
      const existingMemberships = await checkMemberships(contributor.id)
      setMembers((current) => [
        ...current,
        {
          contributor,
          existingMemberships,
          kinshipId: nonReferenteKinships[0].id,
          kinshipObservation: '',
          multiGroupReason: '',
        },
      ])
      setSearch('')
      setResults([])
      setError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo agregar el integrante.')
    }
  }

  async function save() {
    if (!canEdit) return
    if (!referente) {
      setError('Seleccioná un referente del padrón.')
      return
    }

    for (const member of members) {
      const kinship = nonReferenteKinships.find((item) => item.id === member.kinshipId)
      if (kinship?.requiresObservation && !member.kinshipObservation.trim()) {
        setError('Completá la observación para el parentesco Otro.')
        return
      }
      if (member.existingMemberships.length > 0 && !member.multiGroupReason.trim()) {
        setError('Indicá el motivo para integrantes con otras pertenencias activas.')
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/grupos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenteContributorId: referente.id,
          observations: observations.trim() || undefined,
          members: members.map((member) => ({
            contributorId: member.contributor.id,
            kinshipId: member.kinshipId,
            kinshipObservation: member.kinshipObservation.trim() || undefined,
            multiGroupReason: member.multiGroupReason.trim() || undefined,
          })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo crear el grupo.'))
      onCreated(payload.doc.group.id)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo crear el grupo.')
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
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Nuevo grupo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Crear grupo familiar</h1>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-box border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-bold text-content">1. Referente</h2>
          <p className="mt-1 text-sm text-content-muted">Buscá en el padrón y seleccioná quién será el referente.</p>
          {referente ? (
            <div className="mt-4 rounded-box border border-line bg-page p-4">
              <p className="font-semibold text-content">{formatContribuyenteNombre(referente.nombre)}</p>
              <p className="text-sm text-content-muted">DNI {referente.numero_documento ?? '—'}</p>
              <p className="text-sm text-content-muted">{referente.domicilio || 'Sin domicilio'}</p>
              <button className="btn btn-ghost btn-sm mt-3" onClick={() => setReferente(null)} type="button">Cambiar referente</button>
            </div>
          ) : (
            <ContributorSearch
              loading={loadingSearch}
              onSearch={setSearch}
              onSelect={selectReferente}
              results={visibleResults}
              search={search}
            />
          )}
        </section>

        <section className="rounded-box border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-bold text-content">2. Integrantes adicionales</h2>
          <p className="mt-1 text-sm text-content-muted">Opcional. Un grupo puede tener solo al referente.</p>
          <ContributorSearch
            disabled={!referente}
            loading={loadingSearch}
            onSearch={setSearch}
            onSelect={addMember}
            results={visibleResults}
            search={search}
          />
          {members.length > 0 && (
            <div className="mt-4 space-y-4">
              {members.map((member) => {
                const kinship = nonReferenteKinships.find((item) => item.id === member.kinshipId)
                return (
                  <div className="rounded-box border border-line bg-page p-4" key={member.contributor.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-content">{formatContribuyenteNombre(member.contributor.nombre)}</p>
                        <p className="text-sm text-content-muted">DNI {member.contributor.numero_documento ?? '—'}</p>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => setMembers((current) => current.filter((item) => item.contributor.id !== member.contributor.id))}
                        type="button"
                      >
                        <IconX aria-hidden="true" size={16} />
                      </button>
                    </div>
                    <label className="form-control mt-3 gap-1">
                      <span className="label-text font-semibold">Parentesco</span>
                      <select
                        className="select select-bordered bg-surface"
                        onChange={(event) => setMembers((current) => current.map((item) => item.contributor.id === member.contributor.id ? { ...item, kinshipId: event.target.value } : item))}
                        value={member.kinshipId}
                      >
                        {nonReferenteKinships.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    {kinship?.requiresObservation && (
                      <label className="form-control mt-3 gap-1">
                        <span className="label-text font-semibold">Observación</span>
                        <input
                          className="input input-bordered bg-surface"
                          onChange={(event) => setMembers((current) => current.map((item) => item.contributor.id === member.contributor.id ? { ...item, kinshipObservation: event.target.value } : item))}
                          value={member.kinshipObservation}
                        />
                      </label>
                    )}
                    {member.existingMemberships.length > 0 && (
                      <div className="alert alert-warning mt-3">
                        <span>Ya pertenece a {member.existingMemberships.length} grupo(s) activo(s).</span>
                      </div>
                    )}
                    {member.existingMemberships.length > 0 && (
                      <label className="form-control mt-3 gap-1">
                        <span className="label-text font-semibold">Motivo de la nueva pertenencia</span>
                        <textarea
                          className="textarea textarea-bordered bg-surface"
                          onChange={(event) => setMembers((current) => current.map((item) => item.contributor.id === member.contributor.id ? { ...item, multiGroupReason: event.target.value } : item))}
                          value={member.multiGroupReason}
                        />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-box border border-line bg-surface p-5 shadow-sm">
        <label className="form-control gap-1">
          <span className="label-text font-semibold">Observaciones del grupo</span>
          <textarea className="textarea textarea-bordered bg-page" onChange={(event) => setObservations(event.target.value)} value={observations} />
        </label>
        {error && <div className="alert alert-error mt-4" role="alert"><span>{error}</span></div>}
        <div className="mt-4 flex justify-end gap-3">
          <button className="btn btn-ghost" onClick={onBack} type="button">Cancelar</button>
          <button className="btn btn-primary" disabled={saving || !referente} onClick={() => void save()} type="button">
            {saving ? 'Guardando…' : 'Crear grupo'}
          </button>
        </div>
      </section>
    </main>
  )
}

function GroupDetailPanel({
  canEdit,
  groupId,
  onBack,
}: {
  canEdit: boolean
  groupId: string
  onBack: () => void
}) {
  const [group, setGroup] = useState<FamilyGroupView | null>(null)
  const [kinships, setKinships] = useState<KinshipOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadGroup() {
      setLoading(true)
      setError('')
      try {
        const [groupResponse, kinshipResponse] = await Promise.all([
          fetch(`/api/grupos/${groupId}`, { credentials: 'include' }),
          fetch('/api/parentescos', { credentials: 'include' }),
        ])
        const groupPayload = await groupResponse.json().catch(() => null)
        const kinshipPayload = await kinshipResponse.json().catch(() => null)
        if (!groupResponse.ok) throw new Error(errorMessage(groupPayload, 'No se pudo cargar el grupo.'))
        if (!cancelled) {
          setGroup(groupPayload.doc)
          if (kinshipResponse.ok && Array.isArray(kinshipPayload?.docs)) {
            setKinships(kinshipPayload.docs)
          }
        }
      } catch (value) {
        if (!cancelled) {
          setError(value instanceof Error ? value.message : 'No se pudo cargar el grupo.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadGroup()
    return () => {
      cancelled = true
    }
  }, [groupId])

  async function deactivateGroup() {
    const endReason = window.prompt('Motivo de baja del grupo:')
    if (!endReason?.trim()) return
    const response = await fetch(`/api/grupos/${groupId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive', endReason: endReason.trim() }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(errorMessage(payload, 'No se pudo dar de baja el grupo.'))
      return
    }
    setGroup(payload.doc)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[24rem] w-full max-w-7xl items-center justify-center px-4 py-8">
        <span className="loading loading-spinner loading-lg text-primary" />
      </main>
    )
  }

  if (!group) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="alert alert-error" role="alert"><span>{error || 'Grupo no encontrado.'}</span></div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <button className="btn btn-ghost mb-4 gap-2" onClick={onBack} type="button">
        <IconArrowLeft aria-hidden="true" size={18} />
        Volver al listado
      </button>

      <div className="flex flex-col gap-4 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ficha del grupo</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">
            {group.referente ? formatContribuyenteNombre(group.referente.nombre) : 'Grupo familiar'}
          </h1>
          <p className="mt-2 text-sm text-content-muted">
            {group.referente?.domicilio || 'Domicilio no disponible'}
            {group.referente?.barrio ? ` · ${group.referente.barrio}` : ''}
          </p>
        </div>
        {canEdit && group.group.status === 'active' && (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-outline gap-2" onClick={() => setAddMemberOpen(true)} type="button">
              <IconUserPlus aria-hidden="true" size={18} />
              Agregar integrante
            </button>
            <button className="btn btn-error btn-outline" onClick={() => void deactivateGroup()} type="button">
              Dar de baja grupo
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error mt-4" role="alert"><span>{error}</span></div>}
      {group.referenteError && <div className="alert alert-warning mt-4" role="status"><span>{group.referenteError}</span></div>}

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <article className="rounded-box border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-content">Estado</h2>
          <p className="mt-2 text-sm text-content-muted">Alta {group.group.startedAt}</p>
          <span className={`badge mt-3 ${group.group.status === 'active' ? 'badge-success' : 'badge-ghost'}`}>
            {group.group.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </article>
        <article className="rounded-box border border-line bg-surface p-5 shadow-sm lg:col-span-2">
          <h2 className="font-bold text-content">Observaciones</h2>
          <p className="mt-2 text-sm text-content-muted">{group.group.observations || 'Sin observaciones.'}</p>
        </article>
      </section>

      <section className="mt-8 overflow-x-auto rounded-box border border-line bg-surface shadow-sm">
        <table className="table table-zebra">
          <caption className="sr-only">Integrantes del grupo</caption>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Parentesco</th>
              <th>Rol</th>
              <th>Estado</th>
              {canEdit && group.group.status === 'active' && <th><span className="sr-only">Acciones</span></th>}
            </tr>
          </thead>
          <tbody>
            {group.members.map((item) => (
              <tr key={item.member.id}>
                <td className="font-semibold">
                  {item.contributor ? formatContribuyenteNombre(item.contributor.nombre) : item.member.contributorId}
                </td>
                <td>{item.contributor?.numero_documento ?? '—'}</td>
                <td>{item.kinship.label}</td>
                <td>{item.member.isReferent ? 'Referente' : 'Integrante'}</td>
                <td>{item.member.status === 'active' ? 'Activo' : 'Inactivo'}</td>
                {canEdit && group.group.status === 'active' && (
                  <td>
                    {item.member.status === 'active' && !item.member.isReferent && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          const endReason = window.prompt('Motivo de baja de la membresía:')
                          if (!endReason?.trim()) return
                          const response = await fetch(`/api/grupos/${groupId}/miembros/${item.member.id}`, {
                            method: 'PATCH',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ endReason: endReason.trim() }),
                          })
                          const payload = await response.json().catch(() => null)
                          if (!response.ok) {
                            setError(errorMessage(payload, 'No se pudo dar de baja la membresía.'))
                            return
                          }
                          setGroup(payload.doc)
                        }}
                        type="button"
                      >
                        Dar de baja
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {addMemberOpen && (
        <AddMemberDialog
          groupId={groupId}
          kinships={kinships.filter((item) => item.code !== 'referente')}
          onClose={() => setAddMemberOpen(false)}
          onSaved={(updated) => { setGroup(updated); setAddMemberOpen(false) }}
        />
      )}
    </main>
  )
}

function ContributorSearch({
  disabled,
  loading,
  onSearch,
  onSelect,
  results,
  search,
}: {
  disabled?: boolean
  loading: boolean
  onSearch: (value: string) => void
  onSelect: (contributor: Contribuyente) => void
  results: Contribuyente[]
  search: string
}) {
  return (
    <div className="mt-4">
      <label className="input input-bordered flex min-h-11 items-center gap-2 bg-page text-content">
        <IconSearch aria-hidden="true" className="text-content-muted" size={18} />
        <input
          aria-label="Buscar contribuyente"
          disabled={disabled}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Nombre, DNI o número de contribuyente"
          value={search}
        />
      </label>
      {loading && <p className="mt-2 text-sm text-content-muted">Buscando…</p>}
      {!loading && results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((contributor) => (
            <li key={contributor.id}>
              <button
                className="flex w-full items-center justify-between rounded-box border border-line bg-page px-4 py-3 text-left hover:border-primary"
                disabled={disabled}
                onClick={() => onSelect(contributor)}
                type="button"
              >
                <span>
                  <span className="block font-semibold text-content">{formatContribuyenteNombre(contributor.nombre)}</span>
                  <span className="text-sm text-content-muted">DNI {contributor.numero_documento ?? '—'}</span>
                </span>
                <IconUsers aria-hidden="true" className="text-primary" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddMemberDialog({
  groupId,
  kinships,
  onClose,
  onSaved,
}: {
  groupId: string
  kinships: KinshipOption[]
  onClose: () => void
  onSaved: (group: FamilyGroupView) => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Contribuyente[]>([])
  const [selected, setSelected] = useState<Contribuyente | null>(null)
  const [kinshipId, setKinshipId] = useState(kinships[0]?.id ?? '')
  const [kinshipObservation, setKinshipObservation] = useState('')
  const [multiGroupReason, setMultiGroupReason] = useState('')
  const [existingMemberships, setExistingMemberships] = useState<ExistingMembership[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedKinship = kinships.find((item) => item.id === kinshipId)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  const visibleResults = search.trim() ? results : []

  useEffect(() => {
    if (!search.trim()) return
    const timer = window.setTimeout(async () => {
      const params = buildContribuyenteSearchParams(search, 8)
      const response = await fetch(`/api/contribuyentes?${params.toString()}`, { credentials: 'include' })
      const payload = await response.json().catch(() => null)
      if (response.ok) setResults(Array.isArray(payload?.docs) ? payload.docs : [])
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  async function pickContributor(contributor: Contribuyente) {
    setSelected(contributor)
    setSearch('')
    setResults([])
    const response = await fetch(
      `/api/grupos/membresias?contributorId=${encodeURIComponent(contributor.id)}&excludeGroupId=${encodeURIComponent(groupId)}`,
      { credentials: 'include' },
    )
    const payload = await response.json().catch(() => null)
    setExistingMemberships(Array.isArray(payload?.memberships) ? payload.memberships : [])
  }

  async function save() {
    if (!selected) {
      setError('Seleccioná un contribuyente.')
      return
    }
    if (selectedKinship?.requiresObservation && !kinshipObservation.trim()) {
      setError('Completá la observación del parentesco.')
      return
    }
    if (existingMemberships.length > 0 && !multiGroupReason.trim()) {
      setError('Indicá el motivo de la nueva pertenencia.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/grupos/${groupId}/miembros`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributorId: selected.id,
          kinshipId,
          kinshipObservation: kinshipObservation.trim() || undefined,
          multiGroupReason: multiGroupReason.trim() || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo agregar el integrante.'))
      onSaved(payload.doc)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo agregar el integrante.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/50 p-4" role="dialog">
      <div className="max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-box border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <h2 className="text-xl font-bold text-content">Agregar integrante</h2>
            <p className="text-sm text-content-muted">Buscá en el padrón y confirmá el parentesco.</p>
          </div>
          <button aria-label="Cerrar" className="btn btn-ghost btn-sm btn-square" onClick={onClose} ref={closeButtonRef} type="button">
            <IconX aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {selected ? (
            <div className="rounded-box border border-line bg-page p-4">
              <p className="font-semibold">{formatContribuyenteNombre(selected.nombre)}</p>
              <p className="text-sm text-content-muted">DNI {selected.numero_documento ?? '—'}</p>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setSelected(null)} type="button">Cambiar</button>
            </div>
          ) : (
            <ContributorSearch loading={false} onSearch={setSearch} onSelect={pickContributor} results={visibleResults} search={search} />
          )}
          <label className="form-control gap-1">
            <span className="label-text font-semibold">Parentesco</span>
            <select className="select select-bordered bg-page" onChange={(event) => setKinshipId(event.target.value)} value={kinshipId}>
              {kinships.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          {selectedKinship?.requiresObservation && (
            <label className="form-control gap-1">
              <span className="label-text font-semibold">Observación</span>
              <input className="input input-bordered bg-page" onChange={(event) => setKinshipObservation(event.target.value)} value={kinshipObservation} />
            </label>
          )}
          {existingMemberships.length > 0 && (
            <>
              <div className="alert alert-warning"><span>Ya pertenece a otro grupo activo.</span></div>
              <label className="form-control gap-1">
                <span className="label-text font-semibold">Motivo</span>
                <textarea className="textarea textarea-bordered bg-page" onChange={(event) => setMultiGroupReason(event.target.value)} value={multiGroupReason} />
              </label>
            </>
          )}
          {error && <div className="alert alert-error" role="alert"><span>{error}</span></div>}
          <div className="flex justify-end gap-3">
            <button className="btn btn-ghost" onClick={onClose} type="button">Cancelar</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void save()} type="button">
              {saving ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
