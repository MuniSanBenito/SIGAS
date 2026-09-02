import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { canAccessModule } from '@/access/roles'
import config from '@/payload.config'

import { DashboardShell } from '../dashboard-shell'
import { ModulePlaceholder } from '../module-placeholder'

export default async function GroupsPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/login')
  if (!canAccessModule(user, 'groups')) redirect('/')

  return (
    <DashboardShell roles={user.roles}>
      <ModulePlaceholder description="Acá vas a poder administrar contribuyentes y grupos familiares." title="Grupos familiares" />
    </DashboardShell>
  )
}
