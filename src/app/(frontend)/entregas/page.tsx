import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { canAccessModule } from '@/access/roles'
import config from '@/payload.config'

import { DashboardShell } from '../dashboard-shell'
import { EntregasWorkspace } from './entregas-workspace'

export default async function EntregasPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/login')
  if (!canAccessModule(user, 'deliveries')) redirect('/')

  return (
    <DashboardShell roles={user.roles}>
      <EntregasWorkspace />
    </DashboardShell>
  )
}
