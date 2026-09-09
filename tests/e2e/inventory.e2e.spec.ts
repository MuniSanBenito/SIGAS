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

test('stock user can create a product and record an entry', async ({ page }) => {
  await login(page)

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
  await expect(page.getByRole('heading', { name: productName })).toBeVisible()

  await page.getByRole('button', { name: 'Cargar entrada' }).click()
  const entryDialog = page.getByRole('dialog')
  await entryDialog.getByLabel('Producto').selectOption({ label: productName })
  await entryDialog.getByLabel('Cantidad').fill('5')
  await entryDialog.getByRole('button', { name: 'Confirmar operación' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Entrada registrada correctamente.' })).toBeVisible()
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Dar de baja', exact: true }).click()
  const exitDialog = page.getByRole('dialog')
  await exitDialog.getByLabel('Producto').selectOption({ label: productName })
  await exitDialog.getByLabel('Cantidad').fill('2')
  await exitDialog.getByRole('button', { name: 'Confirmar operación' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Baja registrada correctamente.' })).toBeVisible()
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Conteo físico', exact: true }).click()
  const countDialog = page.getByRole('dialog')
  await countDialog.getByLabel('Producto').selectOption({ label: productName })
  await countDialog.getByLabel('Cantidad contada').fill('4')
  await countDialog.getByRole('button', { name: 'Confirmar operación' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Conteo físico registrado correctamente.' })).toBeVisible()
  await expect(page.getByText('4', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Dar de baja producto' }).click()
  const deactivateDialog = page.getByRole('dialog')
  await deactivateDialog.getByLabel('Motivo obligatorio').fill('Producto discontinuado para prueba')
  await deactivateDialog.getByRole('button', { name: 'Confirmar baja' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Producto dado de baja correctamente.' })).toBeVisible()
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible()
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
