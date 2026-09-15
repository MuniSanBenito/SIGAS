import { expect, test, type Page } from '@playwright/test'

import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'

const serverURL = 'http://localhost:3000'

const roleUsers: Record<string, TestUser> = {
  admin: { password: 'test', roles: ['admin'], username: '99887770' },
  administration: { password: 'test', roles: ['administracion'], username: '99887768' },
  both: { password: 'test', roles: ['stock', 'administracion'], username: '99887769' },
  noRole: { password: 'test', roles: [], username: '99887771' },
  stock: { password: 'test', roles: ['stock'], username: '99887767' },
}

async function loginAs(page: Page, user: TestUser) {
  await page.goto(`${serverURL}/login`)
  await page.getByLabel('DNI').fill(user.username)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(`${serverURL}/`)
}

test.beforeAll(async () => {
  for (const user of Object.values(roleUsers)) await seedTestUser(user)
})

test.afterAll(async () => {
  for (const user of Object.values(roleUsers)) await cleanupTestUser(user)
})

test('stock users only see and can open inventory', async ({ page }) => {
  await loginAs(page, roleUsers.stock)

  await expect(page.getByRole('link', { name: 'Inventario', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Grupos familiares', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible()

  await page.goto(`${serverURL}/grupos`)
  await expect(page).toHaveURL(`${serverURL}/`)
})

test('administration users only see and can open family groups', async ({ page }) => {
  await loginAs(page, roleUsers.administration)

  await expect(page.getByRole('link', { name: 'Grupos familiares', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inventario', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Grupos familiares', exact: true })).toBeVisible()

  await page.goto(`${serverURL}/inventario`)
  await expect(page).toHaveURL(`${serverURL}/`)
})

test('multiple roles grant the union of module permissions', async ({ page }) => {
  await loginAs(page, roleUsers.both)

  await expect(page.getByRole('link', { name: 'Grupos familiares', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inventario', exact: true }).first()).toBeVisible()

  await page.goto(`${serverURL}/grupos`)
  await expect(page).toHaveURL(`${serverURL}/grupos`)
  await page.goto(`${serverURL}/inventario`)
  await expect(page).toHaveURL(`${serverURL}/inventario`)
})

test('users without roles see an empty operational home', async ({ page }) => {
  await loginAs(page, roleUsers.noRole)

  await expect(page.getByRole('status')).toContainText('Todavía no tenés módulos asignados.')
  await expect(page.getByRole('link', { name: 'Grupos familiares', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Inventario', exact: true })).toHaveCount(0)
})

test('administrators see all current module cards', async ({ page }) => {
  await loginAs(page, roleUsers.admin)

  await expect(page.getByRole('heading', { name: 'Grupos familiares', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reportes', exact: true })).toBeVisible()
})

test('only administrators can open deliveries', async ({ page }) => {
  await loginAs(page, roleUsers.admin)

  await expect(page.getByRole('link', { name: 'Entregas', exact: true }).first()).toBeVisible()
  await page.goto(`${serverURL}/entregas`)
  await expect(page).toHaveURL(`${serverURL}/entregas`)
  await expect(page.getByRole('heading', { name: 'Entregas', exact: true })).toBeVisible()

  await loginAs(page, roleUsers.stock)
  await expect(page.getByRole('link', { name: 'Entregas', exact: true })).toHaveCount(0)
  await page.goto(`${serverURL}/entregas`)
  await expect(page).toHaveURL(`${serverURL}/`)

  await loginAs(page, roleUsers.administration)
  await expect(page.getByRole('link', { name: 'Entregas', exact: true })).toHaveCount(0)
  await page.goto(`${serverURL}/entregas`)
  await expect(page).toHaveURL(`${serverURL}/`)
})

test('non-administrators are redirected away from Payload Admin', async ({ page }) => {
  await loginAs(page, roleUsers.stock)

  await page.goto(`${serverURL}/admin`)
  await expect(page).toHaveURL(`${serverURL}/admin/unauthorized`)
  await expect(page.getByText('You are not allowed to access this page.')).toBeVisible()
})

test('non-administrators cannot promote themselves through the API', async ({ page }) => {
  await loginAs(page, roleUsers.stock)

  const meResponse = await page.request.get(`${serverURL}/api/users/me`)
  const me = await meResponse.json()
  const updateResponse = await page.request.patch(`${serverURL}/api/users/${me.user.id}`, {
    data: { roles: ['admin'] },
  })
  const updatedMeResponse = await page.request.get(`${serverURL}/api/users/me`)
  const updatedMe = await updatedMeResponse.json()

  expect(updateResponse.status()).toBe(200)
  expect(updatedMe.user.roles).toEqual(['stock'])
})
