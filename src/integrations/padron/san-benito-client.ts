import { readFileSync } from 'node:fs'
import path from 'node:path'

import { getExternalApiConfig } from '@/config'
import type { Contribuyente, ExternalContributorInput } from '@/lib/contribuyente-map'

const SENSITIVE_FIELDS = new Set(['clave_web'])
const LIST_FIELDS = [
  'id',
  'numero_contribuyente',
  'nombre',
  'domicilio',
  'codigo_postal',
  'numero_documento',
  'cuit',
  'fecha_nacimiento',
  'barrio',
  'email',
  'telefono_web',
  'habilitado_web',
]

export interface ContribuyentesListResponse {
  docs: Contribuyente[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  hasNextPage: boolean
  nextPage: number | null
  [key: string]: unknown
}

export class ExternalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ExternalApiError'
  }
}

function externalUrl(path: string, params?: URLSearchParams): string {
  const { baseUrl, apiKey } = getExternalApiConfig()
  if (!baseUrl || !apiKey) {
    throw new ExternalApiError('La API externa no está configurada.', 503)
  }
  const base = baseUrl.replace(/\/$/, '')
  const url = new URL(`${base}/contribuyentes${path}`)
  if (params) url.search = params.toString()
  return url.toString()
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', token: getExternalApiConfig().apiKey }
}

function sanitize<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitize(item)) as T
  const copy: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!SENSITIVE_FIELDS.has(key)) copy[key] = sanitize(item)
  }
  if (copy.numero_documento != null) copy.numero_documento = String(copy.numero_documento)
  return copy as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function applySelect(params: URLSearchParams): void {
  for (const field of LIST_FIELDS) params.set(`select[${field}]`, 'true')
}

async function request<T>(path: string, init?: RequestInit, params?: URLSearchParams): Promise<T> {
  const response = await fetch(externalUrl(path, params), {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      (data as { errors?: { message?: string }[] } | null)?.errors?.[0]?.message ||
      (data as { message?: string } | null)?.message ||
      `Error ${response.status} en la API externa`
    throw new ExternalApiError(message, response.status, data)
  }
  return sanitize(data)
}

function fixtureFilePath(): string | null {
  if (process.env.NODE_ENV === 'production') return null
  return process.env.SIGAS_PADRON_FIXTURE || path.join(process.cwd(), '.e2e-padron.json')
}

function readFixtureContribuyentes(): Contribuyente[] | null {
  const filePath = fixtureFilePath()
  if (!filePath) return null
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { docs?: unknown }
    if (!parsed || !Array.isArray(parsed.docs)) {
      throw new ExternalApiError('El padrón de prueba es inválido.', 502)
    }
    return parsed.docs.map((item) => sanitize(item as Contribuyente))
  } catch (error) {
    if (error instanceof ExternalApiError) throw error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new ExternalApiError('El padrón de prueba es inválido.', 502)
  }
}

function fixtureMatches(doc: Contribuyente, params: URLSearchParams): boolean {
  const clauses: boolean[] = []
  for (const [key, value] of params.entries()) {
    if (/^where\[or]\[\d+]\[nombre]\[contains]$/.test(key)) {
      clauses.push(String(doc.nombre ?? '').toLowerCase().includes(value.toLowerCase()))
    }
    if (/^where\[or]\[\d+]\[numero_documento]\[contains]$/.test(key)) {
      clauses.push(String(doc.numero_documento ?? '').toLowerCase().includes(value.toLowerCase()))
    }
    if (/^where\[or]\[\d+]\[numero_contribuyente]\[equals]$/.test(key)) {
      clauses.push(String(doc.numero_contribuyente ?? '') === value)
    }
  }
  return clauses.length === 0 || clauses.some(Boolean)
}

function fixtureList(docs: Contribuyente[], searchParams: URLSearchParams): ContribuyentesListResponse {
  const limit = Math.max(1, Number.parseInt(searchParams.get('limit') ?? '15', 10) || 15)
  const filtered = docs.filter((doc) => fixtureMatches(doc, searchParams)).slice(0, limit)
  return {
    docs: filtered,
    hasNextPage: false,
    limit,
    nextPage: null,
    page: 1,
    totalDocs: filtered.length,
    totalPages: 1,
  }
}

export async function findContribuyentes(searchParams: URLSearchParams): Promise<ContribuyentesListResponse> {
  const fixture = readFixtureContribuyentes()
  if (fixture) return fixtureList(fixture, searchParams)

  const params = new URLSearchParams(searchParams)
  applySelect(params)
  const data = await request<unknown>('', undefined, params)
  if (!isRecord(data) || !Array.isArray(data.docs)) {
    throw new ExternalApiError('La API externa devolvió un listado inválido.', 502, data)
  }
  return data as ContribuyentesListResponse
}

export async function getContribuyenteById(id: string): Promise<{ doc: Contribuyente }> {
  if (!id.trim()) throw new ExternalApiError('El ID del contribuyente es obligatorio.', 422)
  const fixture = readFixtureContribuyentes()
  if (fixture) {
    const doc = fixture.find((item) => item.id === id)
    if (!doc) throw new ExternalApiError('Contribuyente no encontrado.', 404)
    return { doc }
  }
  const params = new URLSearchParams()
  applySelect(params)
  const data = await request<unknown>(`/${encodeURIComponent(id)}`, undefined, params)
  const document = isRecord(data) && isRecord(data.doc) ? data.doc : data
  if (!isRecord(document) || typeof document.id !== 'string') {
    throw new ExternalApiError('La API externa devolvió un contribuyente inválido.', 502, data)
  }
  return { doc: document as unknown as Contribuyente }
}

export async function createContribuyente(data: ExternalContributorInput): Promise<{ doc: Contribuyente; message?: string }> {
  const result = await request<{ doc: Contribuyente; message?: string }>('', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result
}

export async function updateContribuyente(id: string, data: ExternalContributorInput): Promise<{ doc: Contribuyente; message?: string }> {
  const result = await request<{ doc: Contribuyente; message?: string }>(`/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return result
}
