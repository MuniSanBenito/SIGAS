import { expect, test } from '@playwright/test'

import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const serverURL = 'http://localhost:3000'

test.beforeAll(async () => {
  await seedTestUser()
})

test.afterAll(async () => {
  await cleanupTestUser()
})

test('redirects unauthenticated visitors to the login page', async ({ page }) => {
  await page.goto(serverURL)

  await expect(page).toHaveURL(`${serverURL}/login`)
  await expect(page.getByRole('heading', { name: 'Ingresar a SIGAS' })).toBeVisible()
})

test('shows accessible DNI and password controls', async ({ page }) => {
  await page.goto(`${serverURL}/login`)

  await expect(page.getByLabel('DNI')).toBeVisible()
  await expect(page.getByLabel('Contraseña')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
})

test('toggles and persists the selected color theme', async ({ page }) => {
  await page.goto(`${serverURL}/login`)

  const themeToggle = page.getByRole('button', { name: /Activar modo (oscuro|claro)/ })
  const initialTheme = await page.locator('html').getAttribute('data-theme')
  expect(initialTheme).toMatch(/^sanbenito-(light|dark)$/)

  await themeToggle.click()
  const selectedTheme = await page.locator('html').getAttribute('data-theme')
  expect(selectedTheme).not.toBe(initialTheme)
  await expect(themeToggle).toHaveAttribute('aria-pressed', selectedTheme === 'sanbenito-dark' ? 'true' : 'false')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', selectedTheme ?? '')
})

test('keeps the user on login and shows a generic error for invalid credentials', async ({ page }) => {
  await page.goto(`${serverURL}/login`)
  await page.getByLabel('DNI').fill(testUser.username)
  await page.getByLabel('Contraseña').fill('wrong-password')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(`${serverURL}/login`)
  await expect(page.getByRole('alert').filter({ hasText: 'Las credenciales ingresadas no son válidas.' })).toHaveText(
    'Las credenciales ingresadas no son válidas.',
  )
})

test('logs in with a normalized DNI and renders the protected dashboard', async ({ page }) => {
  await page.goto(`${serverURL}/login`)
  await page.getByLabel('DNI').fill('99.887.766')
  await page.getByLabel('Contraseña').fill(testUser.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(`${serverURL}/`)
  await expect(page.getByRole('heading', { name: 'Bienvenido a SIGAS' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inicio' }).first()).toBeVisible()
})

test('redirects authenticated users away from the login page', async ({ page }) => {
  await page.goto(`${serverURL}/login`)
  await page.getByLabel('DNI').fill(testUser.username)
  await page.getByLabel('Contraseña').fill(testUser.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(`${serverURL}/`)

  await page.goto(`${serverURL}/login`)
  await expect(page).toHaveURL(`${serverURL}/`)
})

test('logs out and protects the dashboard again', async ({ page }) => {
  await page.goto(`${serverURL}/login`)
  await page.getByLabel('DNI').fill(testUser.username)
  await page.getByLabel('Contraseña').fill(testUser.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(`${serverURL}/`)

  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()

  await expect(page).toHaveURL(`${serverURL}/login`)
  await page.goto(serverURL)
  await expect(page).toHaveURL(`${serverURL}/login`)
})

test.describe('responsive navigation', () => {
  test('opens and closes the mobile menu without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(`${serverURL}/login`)
    await page.getByLabel('DNI').fill(testUser.username)
    await page.getByLabel('Contraseña').fill(testUser.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(`${serverURL}/`)

    const menuButton = page.getByRole('button', { name: 'Abrir menú' })
    await expect(menuButton).toBeVisible()
    await menuButton.click()
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).toBeVisible()
    const closeButton = page.getByRole('button', { name: 'Cerrar menú', exact: true })
    await expect(closeButton).toBeVisible()
    await expect(closeButton).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Inicio', exact: true }).last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).not.toBeVisible()

    await menuButton.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).not.toBeVisible()
    await expect(menuButton).toBeFocused()
  })

  test('keeps the sidebar visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${serverURL}/login`)
    await page.getByLabel('DNI').fill(testUser.username)
    await page.getByLabel('Contraseña').fill(testUser.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(`${serverURL}/`)

    await expect(page.getByRole('complementary', { name: 'Navegación principal' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir menú' })).not.toBeVisible()
  })

  test('fits the supported responsive widths without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(`${serverURL}/login`)
    await page.getByLabel('DNI').fill(testUser.username)
    await page.getByLabel('Contraseña').fill(testUser.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(`${serverURL}/`)

    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(serverURL)
      await expect(page).toHaveURL(`${serverURL}/`)

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

      if (width < 1024) {
        await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
      } else {
        await expect(page.getByRole('complementary', { name: 'Navegación principal' })).toBeVisible()
      }
    }
  })
})
