export interface Contribuyente {
  id: string
  numero_contribuyente?: number | string | null
  nombre?: string | null
  domicilio?: string | null
  codigo_postal?: number | string | null
  numero_documento?: string | number | null
  cuit?: string | null
  fecha_nacimiento?: string | null
  barrio?: string | null
  email?: string | null
  telefono_web?: string | null
  habilitado_web?: boolean | null
  clave_web?: string | null
  [key: string]: unknown
}

export interface ContribuyenteFormBody {
  nombre?: unknown
  apellido?: unknown
  dni?: unknown
  cuit?: unknown
  telefono?: unknown
  email?: unknown
  direccion?: unknown
  barrio?: unknown
  fechaNacimiento?: unknown
}

const textValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  return value.trim()
}

const nullableText = (value: unknown): string | undefined => {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value.trim() : undefined
}

const FORM_FIELDS = ['nombre', 'apellido', 'dni', 'cuit', 'telefono', 'email', 'direccion', 'barrio', 'fechaNacimiento'] as const

function validateFormBody(body: ContribuyenteFormBody): string | undefined {
  for (const field of FORM_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return `El campo ${field} debe ser texto.`
    }
  }
  return undefined
}

export interface ExternalContributorInput {
  nombre?: string
  numero_documento?: string
  cuit?: string
  telefono_web?: string
  email?: string
  domicilio?: string
  barrio?: string
  fecha_nacimiento?: string
}

export function mapFormToExternalPayload(body: ContribuyenteFormBody, options: { requireName?: boolean } = {}): {
  data: ExternalContributorInput
  error?: string
} {
  const validationError = validateFormBody(body)
  if (validationError) return { data: {}, error: validationError }

  const nombre = textValue(body.nombre)
  const apellido = textValue(body.apellido)
  const requireName = options.requireName ?? true
  if (requireName && !nombre && !apellido) return { data: {}, error: 'Nombre y apellido son obligatorios.' }

  const data: ExternalContributorInput = {}
  if (nombre || apellido) data.nombre = [apellido, nombre].filter(Boolean).join(' ')

  if (body.dni !== undefined) data.numero_documento = nullableText(body.dni)
  if (body.cuit !== undefined) data.cuit = nullableText(body.cuit)
  if (body.telefono !== undefined) data.telefono_web = nullableText(body.telefono)
  if (body.email !== undefined) data.email = nullableText(body.email)
  if (body.direccion !== undefined) data.domicilio = nullableText(body.direccion)
  if (body.barrio !== undefined) data.barrio = nullableText(body.barrio)
  if (body.fechaNacimiento !== undefined) data.fecha_nacimiento = nullableText(body.fechaNacimiento)
  if (!requireName && Object.keys(data).length === 0) {
    return { data: {}, error: 'Debés enviar al menos un campo para actualizar.' }
  }

  return { data }
}

export function splitNombreApellido(nombre?: string | null): { nombre: string; apellido: string } {
  const parts = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { nombre: '', apellido: '' }
  if (parts.length === 1) return { nombre: parts[0], apellido: '' }
  return { nombre: parts[parts.length - 1], apellido: parts.slice(0, -1).join(' ') }
}

export function formatContribuyenteNombre(nombre?: string | null): string {
  const parts = splitNombreApellido(nombre)
  return parts.apellido ? `${parts.nombre} ${parts.apellido}` : parts.nombre || '—'
}

export function buildContribuyenteSearchParams(query: string, limit = 15): URLSearchParams {
  const value = query.trim()
  const params = new URLSearchParams({ limit: String(limit) })
  if (!value) return params
  params.set('where[or][0][nombre][contains]', value)
  params.set('where[or][1][numero_documento][contains]', value)
  if (/^\d+$/.test(value)) params.set('where[or][2][numero_contribuyente][equals]', value)
  return params
}
