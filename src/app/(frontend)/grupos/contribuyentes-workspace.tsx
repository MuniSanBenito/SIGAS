'use client'

import { IconEdit, IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import type { Role } from '@/access/roles'
import { buildContribuyenteSearchParams, formatContribuyenteNombre, splitNombreApellido, type Contribuyente } from '@/lib/contribuyente-map'

import { AppDialog, AppDialogBody, AppDialogFooter } from '../app-dialog'

type FormState = {
  nombre: string
  apellido: string
  dni: string
  cuit: string
  telefono: string
  email: string
  direccion: string
  barrio: string
  fechaNacimiento: string
}

const emptyForm: FormState = {
  nombre: '',
  apellido: '',
  dni: '',
  cuit: '',
  telefono: '',
  email: '',
  direccion: '',
  barrio: '',
  fechaNacimiento: '',
}

function formFromContributor(contributor: Contribuyente): FormState {
  const name = splitNombreApellido(contributor.nombre)
  return {
    nombre: name.nombre,
    apellido: name.apellido,
    dni: contributor.numero_documento == null ? '' : String(contributor.numero_documento),
    cuit: contributor.cuit ?? '',
    telefono: contributor.telefono_web ?? '',
    email: contributor.email ?? '',
    direccion: contributor.domicilio ?? '',
    barrio: contributor.barrio ?? '',
    fechaNacimiento: contributor.fecha_nacimiento ?? '',
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const value = payload as { error?: { message?: unknown }; errors?: { message?: unknown }[] }
  const message = value.error?.message ?? value.errors?.[0]?.message
  return typeof message === 'string' ? message : fallback
}

export function ContribuyentesWorkspace({
  embedded = false,
  roles,
}: {
  embedded?: boolean
  roles: readonly Role[]
}) {
  const canEdit = roles.includes('admin') || roles.includes('administracion')
  const [contributors, setContributors] = useState<Contribuyente[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contribuyente | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const query = useMemo(() => {
    const params = buildContribuyenteSearchParams(search, limit)
    params.set('page', String(page))
    params.set('sort', '-numero_contribuyente')
    return params
  }, [limit, page, search])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setRefreshing(true)
      setError('')
      try {
        const response = await fetch(`/api/contribuyentes?${query.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(errorMessage(payload, 'No se pudieron cargar los contribuyentes.'))
        setContributors(Array.isArray(payload?.docs) ? payload.docs : [])
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

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(contributor: Contribuyente) {
    setEditing(contributor)
    setForm(formFromContributor(contributor))
    setFormError('')
    setModalOpen(true)
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError('')
  }

  async function save() {
    if (!form.nombre.trim() && !form.apellido.trim()) {
      setFormError('Ingresá nombre o apellido.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const response = await fetch(editing ? `/api/contribuyentes/${editing.id}` : '/api/contribuyentes', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, 'No se pudo guardar el contribuyente.'))
      setModalOpen(false)
      setPage(1)
      setContributors((current) => (editing ? current.map((item) => item.id === editing.id ? (payload.doc ?? payload) : item) : current))
      setRefreshKey((value) => value + 1)
    } catch (value) {
      setFormError(value instanceof Error ? value.message : 'No se pudo guardar el contribuyente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id={embedded ? undefined : 'main-content'}>
      <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Padrón municipal</p>
          {embedded ? (
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-content sm:text-3xl">Contribuyentes</h2>
          ) : (
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Contribuyentes</h1>
          )}
          <p className="mt-3 max-w-2xl text-base leading-7 text-content-muted">Consultá y actualizá el padrón oficial sin duplicar sus datos en SIGAS.</p>
        </div>
        {canEdit && <button className="btn btn-primary min-h-11 gap-2 self-start sm:self-auto" onClick={openCreate} type="button"><IconPlus aria-hidden="true" size={18} />Nuevo contribuyente</button>}
      </div>

      <section aria-label="Listado de contribuyentes" className="mt-7">
        <div className="flex flex-col gap-3 rounded-box border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
          <label className="input input-bordered flex min-h-11 flex-1 items-center gap-2 bg-page text-content">
            <IconSearch aria-hidden="true" className="text-content-muted" size={18} />
            <span className="sr-only">Buscar contribuyentes</span>
            <input aria-label="Buscar por nombre, DNI o número de contribuyente" onChange={(event) => { setPage(1); setSearch(event.target.value) }} placeholder="Nombre, DNI o número de contribuyente" value={search} />
          </label>
          <button aria-label="Actualizar listado" className="btn btn-ghost min-h-11 gap-2" disabled={refreshing} onClick={() => setRefreshKey((value) => value + 1)} type="button"><IconRefresh aria-hidden="true" className={refreshing ? 'animate-spin' : ''} size={18} />Actualizar</button>
        </div>

        {error && <div className="alert alert-error mt-4" role="alert"><span>{error}</span></div>}
        <div className="mt-4 overflow-x-auto rounded-box border border-line bg-surface shadow-sm">
          {loading ? <div aria-label="Cargando contribuyentes" aria-live="polite" className="flex min-h-64 items-center justify-center"><span className="loading loading-spinner loading-lg text-primary" /></div> : <table className="table table-zebra"><caption className="sr-only">Listado paginado de contribuyentes</caption><thead><tr><th>N°</th><th>Nombre</th><th>DNI</th><th>Domicilio</th><th>Teléfono</th><th>Email</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{contributors.length === 0 ? <tr><td className="py-12 text-center text-content-muted" colSpan={7}>No se encontraron contribuyentes.</td></tr> : contributors.map((contributor) => <tr key={contributor.id}><td className="font-semibold">{contributor.numero_contribuyente ?? '—'}</td><td className="font-semibold">{formatContribuyenteNombre(contributor.nombre)}</td><td>{contributor.numero_documento ?? '—'}</td><td>{contributor.domicilio || '—'}</td><td>{contributor.telefono_web || '—'}</td><td>{contributor.email || '—'}</td><td>{canEdit && <button aria-label={`Editar ${formatContribuyenteNombre(contributor.nombre)}`} className="btn btn-ghost btn-sm gap-2" onClick={() => openEdit(contributor)} type="button"><IconEdit aria-hidden="true" size={16} />Editar</button>}</td></tr>)}</tbody></table>}
        </div>

        {!loading && totalDocs > 0 && <div className="flex flex-col gap-3 py-4 text-sm text-content-muted sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {((page - 1) * limit) + 1}–{Math.min(page * limit, totalDocs)} de {totalDocs.toLocaleString('es-AR')}</span><div className="flex items-center gap-2"><label className="sr-only" htmlFor="page-size">Registros por página</label><select className="select select-bordered select-sm bg-surface" id="page-size" onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }} value={limit}><option value={15}>15 / pág.</option><option value={30}>30 / pág.</option><option value={50}>50 / pág.</option></select><button className="btn btn-ghost btn-sm" disabled={page <= 1 || refreshing} onClick={() => setPage((value) => value - 1)} type="button">Anterior</button><span aria-live="polite">{page} / {totalPages}</span><button className="btn btn-ghost btn-sm" disabled={page >= totalPages || refreshing} onClick={() => setPage((value) => value + 1)} type="button">Siguiente</button></div></div>}
      </section>

      {modalOpen && (
        <AppDialog
          eyebrow="Padrón municipal"
          onClose={() => setModalOpen(false)}
          size="xl"
          title={editing ? 'Editar contribuyente' : 'Nuevo contribuyente'}
        >
          <AppDialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                { key: 'nombre', label: 'Nombre' },
                { key: 'apellido', label: 'Apellido' },
                { key: 'dni', label: 'DNI' },
                { key: 'cuit', label: 'CUIT' },
                { key: 'telefono', label: 'Teléfono' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'direccion', label: 'Dirección' },
                { key: 'barrio', label: 'Barrio' },
                { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date' },
              ] as const).map(({ key, label, type }) => (
                <label className="form-control gap-1" key={key}>
                  <span className="label-text font-semibold text-content">
                    {label}
                    {(key === 'nombre' || key === 'apellido') && <span className="text-error"> *</span>}
                  </span>
                  <input
                    className="input input-bordered bg-page text-content"
                    onChange={(event) => updateField(key, event.target.value)}
                    type={type ?? 'text'}
                    value={form[key]}
                  />
                </label>
              ))}
            </div>
            {formError && (
              <div className="alert alert-error mt-5" role="alert">
                <span>{formError}</span>
              </div>
            )}
          </AppDialogBody>
          <AppDialogFooter>
            <button className="btn btn-ghost min-h-11" onClick={() => setModalOpen(false)} type="button">
              Cancelar
            </button>
            <button className="btn btn-primary min-h-11" disabled={saving} onClick={() => void save()} type="button">
              {saving && <span className="loading loading-spinner loading-sm" />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </AppDialogFooter>
        </AppDialog>
      )}
    </main>
  )
}
