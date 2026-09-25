import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'

const serverURL = 'http://localhost:3000'
const stockUser: TestUser = { password: 'test', roles: ['stock'], username: '99887772' }
const categoryName = `E2E category ${Date.now()}`
const productName = `E2E product ${Date.now()}`

async function login(page: Page) {
  await page.goto(`${serverURL}/login`)
  await page.getByLabel('DNI').fill(stockUser.username)
  await page.getByLabel('Contraseña').fill(stockUser.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(`${serverURL}/`)
  await page.getByRole('link', { name: 'Inventario', exact: true }).first().click()
  await expect(page).toHaveURL(`${serverURL}/inventario`)
}

async function openCatalog(page: Page) {
  await page.getByRole('tab', { name: 'Catálogo' }).click()
}

async function openLoad(page: Page) {
  await page.getByRole('button', { name: 'Cargar', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.beforeAll(async () => {
  await seedTestUser(stockUser)
})

test.afterAll(async () => {
  const payload = await getPayload({ config: await config })
  const products = await payload.find({ collection: 'products', depth: 0, limit: 10, overrideAccess: true, where: { name: { equals: productName } } })
  const categories = await payload.find({ collection: 'product-categories', depth: 0, limit: 10, overrideAccess: true, where: { name: { equals: categoryName } } })
  for (const product of products.docs) {
    await payload.delete({ collection: 'audit-logs', where: { targetId: { equals: product.id } }, overrideAccess: true })
    await payload.delete({ collection: 'stock-movements', where: { product: { equals: product.id } }, overrideAccess: true })
    await payload.delete({ collection: 'stock-balances', where: { product: { equals: product.id } }, overrideAccess: true })
    await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
  }
  for (const category of categories.docs) await payload.delete({ collection: 'product-categories', id: category.id, overrideAccess: true })
  await cleanupTestUser(stockUser)
})

test('stock user can create a product and record loads', async ({ page }) => {
  await login(page)

  await openCatalog(page)
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

  await page.getByRole('tab', { name: 'Stock' }).click()
  await expect(page.getByRole('heading', { name: productName })).toBeVisible()

  await openLoad(page)
  const loadDialog = page.getByRole('dialog')
  await loadDialog.getByRole('button', { name: 'Llegó mercadería' }).click()
  await loadDialog.getByLabel('Producto').selectOption({ label: productName })
  await loadDialog.getByLabel('Cantidad').fill('5')
  await loadDialog.getByRole('button', { name: 'Confirmar carga' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Mercadería cargada para 1 producto.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: productName }).locator('xpath=ancestor::article').getByText('5', { exact: true })).toBeVisible()

  await openLoad(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Se perdió o venció' }).click()
  await page.getByRole('dialog').getByLabel('Producto').selectOption({ label: productName })
  await page.getByRole('dialog').getByLabel('Cantidad').fill('2')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar carga' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salida registrada para 1 producto.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: productName }).locator('xpath=ancestor::article').getByText('3', { exact: true })).toBeVisible()

  await openLoad(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Esto es lo que hay' }).click()
  await page.getByRole('dialog').getByLabel('Cuánto hay').fill('4')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar carga' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Conteo guardado para 1 producto.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: productName }).locator('xpath=ancestor::article').getByText('4', { exact: true })).toBeVisible()

  await openCatalog(page)
  await page.getByRole('button', { name: 'Dejar de usar' }).first().click()
  const deactivateDialog = page.getByRole('dialog')
  await deactivateDialog.getByLabel('Motivo obligatorio').fill('Producto discontinuado para prueba')
  await deactivateDialog.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'El producto dejó de usarse correctamente.' })).toBeVisible()
  await expect(page.getByText('Dejó de usarse', { exact: true })).toBeVisible()
})

test('stock user can edit catalog items, undo a movement, and version a bolson', async ({ page }) => {
  await login(page)
  const abmCategory = `E2E ABM category ${Date.now()}`
  const abmProduct = `E2E ABM product ${Date.now()}`

  await openCatalog(page)
  await page.getByRole('button', { name: 'Nueva categoría' }).click()
  await page.getByRole('dialog').getByLabel('Nombre').fill(abmCategory)
  await page.getByRole('dialog').getByRole('button', { name: 'Crear categoría' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Categoría creada correctamente.' })).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const productDialog = page.getByRole('dialog')
  await productDialog.getByLabel('Nombre').fill(abmProduct)
  await productDialog.getByLabel('Categoría').selectOption({ label: abmCategory })
  await productDialog.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Producto creado correctamente.' })).toBeVisible()

  await openLoad(page)
  const loadDialog = page.getByRole('dialog')
  await loadDialog.getByRole('button', { name: 'Llegó mercadería' }).click()
  await loadDialog.getByLabel('Producto').selectOption({ label: abmProduct })
  await loadDialog.getByLabel('Cantidad').fill('5')
  await loadDialog.getByRole('button', { name: 'Confirmar carga' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Mercadería cargada para 1 producto.' })).toBeVisible()

  await openCatalog(page)
  await page.getByRole('button', { name: abmCategory, exact: true }).click()
  await page.getByRole('dialog').getByLabel('Nombre').fill(`${abmCategory} editada`)
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Categoría actualizada correctamente.' })).toBeVisible()

  await page.getByRole('heading', { name: abmProduct }).locator('xpath=ancestor::article').getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('dialog').getByLabel('Stock mínimo').fill('1')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Producto actualizado correctamente.' })).toBeVisible()

  await page.getByRole('tab', { name: 'Historial' }).click()
  await expect(page.getByText('Compra')).toBeVisible()
  await expect(page.getByText('purchase')).not.toBeVisible()
  await page.getByRole('button', { name: 'Deshacer' }).first().click()
  await page.getByRole('dialog').getByLabel('Motivo obligatorio').fill('Entrada registrada por error')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Movimiento deshecho correctamente.' })).toBeVisible()
  await expect(page.getByText('Anulado').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Bolsones' }).click()
  await page.getByRole('button', { name: 'Nuevo bolsón' }).click()
  const recipeDialog = page.getByRole('dialog')
  const bundleName = `E2E bundle ${Date.now()}`
  await recipeDialog.getByLabel('Nombre del bolsón').fill(bundleName)
  await recipeDialog.getByRole('button', { name: 'Crear bolsón' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Bolsón creado correctamente.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: bundleName })).toBeVisible()

  await page.getByRole('button', { name: 'Cambiar composición' }).click()
  await recipeDialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Composición del bolsón actualizada correctamente.' })).toBeVisible()
  await expect(page.getByText('Versión 2')).toBeVisible()
})

test('inventory remains usable without horizontal overflow at supported widths', async ({ page }) => {
  await login(page)

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${serverURL}/inventario`)
    await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  }
})
