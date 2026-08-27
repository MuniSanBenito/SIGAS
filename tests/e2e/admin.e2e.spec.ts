import { expect, test } from '@playwright/test'

test('shows the admin login page', async ({ page }) => {
  await page.goto('http://localhost:3000/admin')

  await expect(page).toHaveURL('http://localhost:3000/admin')
  await expect(page.locator('input[name="username"]')).toBeVisible()
})
