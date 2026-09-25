/**
 * Carga inicial de categorías, productos y saldos.
 *
 * Sin --apply solo imprime el resumen y no abre la base.
 * Con --apply escribe en la base de DATABASE_URL (la del entorno, no un archivo fijo).
 *
 * PowerShell, apuntando a Coolify:
 *   $env:DATABASE_URL = "mongodb://usuario:clave@host:puerto/sigas"
 *   $env:PAYLOAD_SECRET = "el-secreto-de-esa-instancia"
 *   $env:SEED_CONFIRM = "si"
 *   pnpm run seed:inventario -- --apply
 *
 * Opcional: $env:SEED_USERNAME = "dni-del-usuario" para atribuir los movimientos.
 * Reejecutar es seguro: la clave de operación no duplica el conteo.
 */
import { getPayload, type Payload } from 'payload'

import { hasRole } from '../src/access/roles.js'
import { recordStockMovement, type InventoryRequest } from '../src/inventory/stock-service.js'
import type { User } from '../src/payload-types.js'
import config from '../src/payload.config.js'
import { SEED_CATEGORIES, SEED_ITEMS, SEED_OPERATIONAL_DATE, type SeedItem } from './inventario-inicial.data.js'

const OPERATION_PREFIX = 'apertura-2026-09-25'

function operationKey(name: string): string {
  return `${OPERATION_PREFIX}:${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

function observation(item: SeedItem): string {
  return [item.detail ? `Detalle: ${item.detail}` : '', item.note ?? '', `Origen: ${item.source}`].filter(Boolean).join(' ')
}

function describeDatabase(url: string): string {
  const normalized = url.replace(/^mongodb(\+srv)?:\/\//, 'http://')
  const parsed = new URL(normalized)
  const port = parsed.port ? `:${parsed.port}` : ''
  return `${parsed.hostname}${port}${parsed.pathname}`
}

function printPlan(): void {
  const withStock = SEED_ITEMS.filter((item) => (item.quantity ?? 0) > 0)
  const zero = SEED_ITEMS.filter((item) => item.quantity === 0)
  const unknown = SEED_ITEMS.filter((item) => item.quantity === null)
  const units = withStock.reduce((sum, item) => sum + (item.quantity ?? 0), 0)

  console.log(`Categorías: ${SEED_CATEGORIES.length}`)
  console.log(`Productos: ${SEED_ITEMS.length}`)
  console.log(`Con saldo: ${withStock.length} (${units} unidades)`)
  console.log(`En cero: ${zero.length}`)
  console.log(`Sin cantidad en la planilla: ${unknown.length}`)
  console.log('')
  for (const name of SEED_CATEGORIES) {
    const items = SEED_ITEMS.filter((item) => item.category === name)
    console.log(`${name} (${items.length})`)
    for (const item of items) {
      const qty = item.quantity === null ? 'sin cantidad' : String(item.quantity)
      const extra = item.note ? ` — ${item.note}` : ''
      console.log(`  ${qty}\t${item.name}${extra}`)
    }
  }
}

async function findActor(payload: Payload): Promise<User> {
  const username = process.env.SEED_USERNAME?.trim()
  const result = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    ...(username ? { where: { username: { equals: username } } } : {}),
  })
  const users = result.docs as User[]
  const actor = username ? users[0] : users.find((user) => hasRole(user, 'admin') || hasRole(user, 'stock'))
  if (!actor) {
    throw new Error(username ? `No existe el usuario ${username}.` : 'No hay un usuario admin o de stock para atribuir el conteo.')
  }
  return actor
}

async function ensureCategory(payload: Payload, name: string): Promise<string> {
  const existing = await payload.find({
    collection: 'product-categories',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { name: { equals: name } },
  })
  if (existing.docs[0]) return existing.docs[0].id

  const created = await payload.create({
    collection: 'product-categories',
    data: { isActive: true, name },
    overrideAccess: true,
  })
  return created.id
}

async function ensureProduct(payload: Payload, item: SeedItem, categoryId: string): Promise<{ created: boolean; id: string }> {
  const existing = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { name: { equals: item.name } },
  })
  if (existing.docs[0]) return { created: false, id: existing.docs[0].id }

  const created = await payload.create({
    collection: 'products',
    data: {
      category: categoryId,
      isActive: true,
      minimumStock: 0,
      name: item.name,
      tracksLotExpiration: false,
    },
    overrideAccess: true,
  })
  return { created: true, id: created.id }
}

async function applySeed(): Promise<void> {
  if (process.env.SEED_CONFIRM !== 'si') {
    throw new Error('Falta SEED_CONFIRM=si. Sin eso el script no escribe.')
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl || !process.env.PAYLOAD_SECRET) {
    throw new Error('Definí DATABASE_URL y PAYLOAD_SECRET de la instancia de Coolify antes de --apply.')
  }

  console.log(`Base destino: ${describeDatabase(databaseUrl)}`)
  const payload = await getPayload({ config })
  const actor = await findActor(payload)
  const req = { payload, user: actor } as unknown as InventoryRequest
  console.log(`Movimientos atribuidos a: ${actor.username}`)

  const categoryIds = new Map<string, string>()
  for (const name of SEED_CATEGORIES) {
    categoryIds.set(name, await ensureCategory(payload, name))
  }

  let createdProducts = 0
  let counted = 0
  let skipped = 0

  for (const item of SEED_ITEMS) {
    const categoryId = categoryIds.get(item.category)
    if (!categoryId) throw new Error(`Categoría sin alta: ${item.category}`)

    const product = await ensureProduct(payload, item, categoryId)
    if (product.created) createdProducts += 1

    if (item.quantity === null || item.quantity === 0) {
      skipped += 1
      continue
    }

    const key = operationKey(item.name)
    const already = await payload.find({
      collection: 'stock-movements',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { operationKey: { equals: key } },
    })
    if (already.docs[0]) {
      skipped += 1
      continue
    }

    const balance = await payload.find({
      collection: 'stock-balances',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { product: { equals: product.id } },
    })
    const current = balance.docs[0]?.quantity ?? 0
    if (current > 0) {
      console.log(`Salto ${item.name}: ya tiene saldo ${current}.`)
      skipped += 1
      continue
    }

    await recordStockMovement(req, {
      movement: {
        countedQuantity: item.quantity,
        mode: 'physicalCount',
        observation: observation(item),
        operationalDate: SEED_OPERATIONAL_DATE,
        productId: product.id,
        source: item.source,
      },
      operationKey: key,
    })
    counted += 1
  }

  console.log(`Listo. Productos nuevos: ${createdProducts}. Conteos: ${counted}. Sin movimiento: ${skipped}.`)
  process.exit(0)
}

const apply = process.argv.includes('--apply')

if (!apply) {
  printPlan()
  console.log('')
  console.log('Esto no escribió nada. Para cargar la base de Coolify, pasá --apply con DATABASE_URL, PAYLOAD_SECRET y SEED_CONFIRM=si.')
} else {
  applySeed().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
