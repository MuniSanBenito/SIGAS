import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'

const serverURL = 'http://localhost:3000'
const fixturePath = path.resolve(process.cwd(), '.e2e-padron.json')
const stamp = Date.now()
const contributorId = `e2e-pilot-${stamp}`
const contributorDni = `40${String(stamp).slice(-6)}`
const displayName = 'ANA PILOTO'
const categoryName = `E2E pilot category ${stamp}`
const productName = `E2E pilot product ${stamp}`
const bundleName = `E2E pilot bundle ${stamp}`

const administrationUser: TestUser = {
  password: 'test',
  roles: ['administracion'],
  username: '99887780',
}
const stockUser: TestUser = {
  password: 'test',
  roles: ['stock'],
  username: '99887781',
}

async function loginAs(page: Page, user: TestUser) {
  await page.goto(`${serverURL}/login`)
  if (!page.url().endsWith('/login')) {
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
    await expect(page).toHaveURL(`${serverURL}/login`)
  }
  await page.getByLabel('DNI').fill(user.username)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(`${serverURL}/`, { timeout: 30_000 })
}

test.beforeAll(async () => {
  writeFileSync(
    fixturePath,
    JSON.stringify({
      docs: [
        {
          barrio: 'Centro',
          domicilio: 'Calle Falsa 123',
          id: contributorId,
          nombre: 'PILOTO ANA',
          numero_documento: contributorDni,
        },
      ],
    }),
  )
  await seedTestUser(administrationUser)
  await seedTestUser(stockUser)
})

test.afterAll(async () => {
  rmSync(fixturePath, { force: true })
  const payload = await getPayload({ config: await config })

  const groups = await payload.find({
    collection: 'family-groups',
    depth: 0,
    limit: 10,
    overrideAccess: true,
    where: { referenteContributorId: { equals: contributorId } },
  })
  const groupIds = groups.docs.map((group) => group.id)
  if (groupIds.length > 0) {
    const deliveries = await payload.find({
      collection: 'deliveries',
      depth: 0,
      limit: 20,
      overrideAccess: true,
      where: { group: { in: groupIds } },
    })
    const deliveryIds = deliveries.docs.map((delivery) => delivery.id)
    if (deliveryIds.length > 0) {
      await payload.delete({
        collection: 'delivery-lines',
        overrideAccess: true,
        where: { delivery: { in: deliveryIds } },
      })
      await payload.delete({
        collection: 'delivery-bundles',
        overrideAccess: true,
        where: { delivery: { in: deliveryIds } },
      })
      await payload.delete({
        collection: 'audit-logs',
        overrideAccess: true,
        where: { targetId: { in: deliveryIds } },
      })
      for (const id of deliveryIds) {
        await payload.delete({ collection: 'deliveries', id, overrideAccess: true })
      }
    }
    await payload.delete({
      collection: 'group-members',
      overrideAccess: true,
      where: { group: { in: groupIds } },
    })
    await payload.delete({
      collection: 'audit-logs',
      overrideAccess: true,
      where: { targetId: { in: groupIds } },
    })
    for (const id of groupIds) {
      await payload.delete({ collection: 'family-groups', id, overrideAccess: true })
    }
  }

  const products = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    where: { name: { equals: productName } },
  })
  for (const product of products.docs) {
    await payload.delete({
      collection: 'stock-movements',
      overrideAccess: true,
      where: { product: { equals: product.id } },
    })
    await payload.delete({
      collection: 'stock-balances',
      overrideAccess: true,
      where: { product: { equals: product.id } },
    })
    await payload.delete({
      collection: 'audit-logs',
      overrideAccess: true,
      where: { targetId: { equals: product.id } },
    })
    await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
  }

  const bundles = await payload.find({
    collection: 'bundles',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    where: { name: { equals: bundleName } },
  })
  for (const bundle of bundles.docs) {
    await payload.delete({
      collection: 'bundle-versions',
      overrideAccess: true,
      where: { bundle: { equals: bundle.id } },
    })
    await payload.delete({ collection: 'bundles', id: bundle.id, overrideAccess: true })
  }

  const categories = await payload.find({
    collection: 'product-categories',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    where: { name: { equals: categoryName } },
  })
  for (const category of categories.docs) {
    await payload.delete({ collection: 'product-categories', id: category.id, overrideAccess: true })
  }

  await cleanupTestUser(administrationUser)
  await cleanupTestUser(stockUser)
})

test('administration creates a group from the padron, stock loads a bundle, and the delivery discounts stock', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  await loginAs(page, administrationUser)
  await page.getByRole('link', { name: 'Grupos familiares', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nuevo grupo' }).click()
  await page.getByLabel('Buscar contribuyente').first().fill(contributorDni)
  await page.locator('section').filter({ hasText: '1. Referente' }).getByRole('button', { name: new RegExp(displayName) }).click()
  await page.getByRole('button', { name: 'Crear grupo' }).click()
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()

  await loginAs(page, stockUser)
  await page.getByRole('link', { name: 'Inventario', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Catálogo' }).click()
  await page.getByRole('button', { name: 'Nueva categoría' }).click()
  await page.getByRole('dialog').getByLabel('Nombre').fill(categoryName)
  await page.getByRole('dialog').getByRole('button', { name: 'Crear categoría' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Categoría creada correctamente.' })).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const productDialog = page.getByRole('dialog')
  await productDialog.getByLabel('Nombre').fill(productName)
  await productDialog.getByLabel('Categoría').selectOption({ label: categoryName })
  await productDialog.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Producto creado correctamente.' })).toBeVisible()

  await page.getByRole('button', { name: 'Cargar', exact: true }).first().click()
  const loadDialog = page.getByRole('dialog')
  await loadDialog.getByRole('button', { name: 'Llegó mercadería' }).click()
  await loadDialog.getByRole('combobox', { name: 'Producto', exact: true }).selectOption({ label: productName })
  await loadDialog.getByLabel('Cantidad').fill('6')
  await loadDialog.getByRole('button', { name: 'Confirmar carga' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Mercadería cargada para 1 producto.' })).toBeVisible()

  await page.getByRole('tab', { name: 'Bolsones' }).click()
  await page.getByRole('button', { name: 'Nuevo bolsón' }).click()
  const recipeDialog = page.getByRole('dialog')
  await recipeDialog.getByLabel('Nombre del bolsón').fill(bundleName)
  await recipeDialog.getByLabel('Producto de la línea 1').selectOption({ label: productName })
  await recipeDialog.getByLabel('Cantidad de la línea 1').fill('2')
  await recipeDialog.getByRole('button', { name: 'Crear bolsón' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Bolsón creado correctamente.' })).toBeVisible()

  await loginAs(page, administrationUser)
  await page.getByRole('link', { name: 'Entregas', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nueva entrega' }).click()
  await page.getByLabel('Buscar grupo').fill(contributorDni)
  await page.getByRole('button', { name: new RegExp(displayName) }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  const bundleSelect = page.getByLabel('Bolsón vigente')
  await expect(bundleSelect).toContainText(bundleName)
  await bundleSelect.selectOption({ label: `${bundleName} v1` })
  await page.getByRole('button', { name: 'Agregar bolsón' }).click()
  await page.getByRole('button', { name: 'Ver propuesta' }).click()
  await page.getByRole('button', { name: 'Confirmar entrega' }).click()
  await expect(page.getByText('Entrega confirmada')).toBeVisible()
  await expect(page.getByText('2 unidades')).toBeVisible()

  await loginAs(page, stockUser)
  await page.getByRole('link', { name: 'Inventario', exact: true }).first().click()
  await page.getByLabel('Buscar productos').fill(productName)
  await expect(page.getByRole('heading', { name: productName })).toBeVisible()
  await expect(page.getByRole('heading', { name: productName }).locator('xpath=ancestor::article').getByText('4', { exact: true })).toBeVisible()
})
