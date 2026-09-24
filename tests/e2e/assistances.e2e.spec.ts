import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'

const serverURL = 'http://localhost:3000'
const fixturePath = path.resolve(process.cwd(), '.e2e-padron.json')
const stamp = Date.now()
const contributorId = `e2e-assist-${stamp}`
const contributorDni = `41${String(stamp).slice(-6)}`
const displayName = 'LUIS ASISTENCIA'
const reportDir = mkdtempSync(path.join(tmpdir(), 'sigas-e2e-report-'))
const reportPath = path.join(reportDir, 'informe.png')

const administrationUser: TestUser = {
  password: 'test',
  roles: ['administracion'],
  username: '99887782',
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
  reportPath,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
)
  writeFileSync(
    fixturePath,
    JSON.stringify({
      docs: [
        {
          barrio: 'Centro',
          domicilio: 'Calle Falsa 123',
          id: contributorId,
          nombre: 'ASISTENCIA LUIS',
          numero_documento: contributorDni,
        },
      ],
    }),
  )
  await seedTestUser(administrationUser)
})

test.afterAll(async () => {
  rmSync(fixturePath, { force: true })
  rmSync(reportDir, { force: true, recursive: true })
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
        collection: 'delivery-assistances',
        overrideAccess: true,
        where: { delivery: { in: deliveryIds } },
      })
      await payload.delete({
        collection: 'delivery-reports',
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
    for (const id of groupIds) {
      await payload.delete({ collection: 'family-groups', id, overrideAccess: true })
    }
  }
  await cleanupTestUser(administrationUser)
})

test('administration records an assistance delivery with a report and a returned loan', async ({ page }) => {
  await loginAs(page, administrationUser)
  await page.getByRole('link', { name: 'Grupos familiares', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nuevo grupo' }).click()
  await page.getByLabel('Buscar contribuyente').first().fill(contributorDni)
  await page.locator('section').filter({ hasText: '1. Referente' }).getByRole('button', { name: new RegExp(displayName) }).click()
  await page.getByRole('button', { name: 'Crear grupo' }).click()
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible()

  await page.getByRole('link', { name: 'Entregas', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nueva entrega' }).click()
  await page.getByLabel('Buscar grupo').fill(contributorDni)
  await page.getByRole('button', { name: new RegExp(displayName) }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.getByLabel('Tipo').selectOption({ label: 'Dinero' })
  await page.getByLabel('Concepto').fill('Ayuda extraordinaria')
  await page.getByLabel('Monto en pesos').fill('8000')
  await page.getByRole('button', { name: 'Agregar asistencia' }).click()

  await page.getByLabel('Tipo').selectOption({ label: 'Préstamo ortopédico' })
  await page.getByLabel('Descripción').fill('Muletas')
  await page.getByRole('button', { name: 'Agregar asistencia' }).click()
  await page.getByRole('button', { name: 'Ver propuesta' }).click()

  await page.getByLabel('Informe de sustento (opcional)').setInputFiles(reportPath)
  await page.getByRole('button', { name: 'Confirmar entrega' }).click()

  await expect(page.getByText('Entrega confirmada')).toBeVisible()
  await expect(page.getByText('Dinero')).toBeVisible()
  await expect(page.getByText('Ayuda extraordinaria')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar informe' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar devolución' }).click()
  await expect(page.getByText('Devuelto')).toBeVisible()
})
