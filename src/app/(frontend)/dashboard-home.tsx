import { IconChartBar, IconHeartHandshake, IconPackages, IconSparkles, IconUsers } from '@tabler/icons-react'
import type { ReactNode } from 'react'

import { DashboardShell } from './dashboard-shell'

type ModuleCard = {
  description: string
  icon: (props: { 'aria-hidden'?: boolean | 'true' | 'false'; className?: string; stroke?: number }) => ReactNode
  title: string
}

const moduleCards: ModuleCard[] = [
  {
    description: 'Organización de referentes e integrantes del padrón municipal.',
    icon: IconUsers,
    title: 'Grupos familiares',
  },
  {
    description: 'Productos, lotes y movimientos del depósito central.',
    icon: IconPackages,
    title: 'Inventario',
  },
  {
    description: 'Registro de asistencia y entregas efectivas.',
    icon: IconHeartHandshake,
    title: 'Entregas',
  },
  {
    description: 'Información operativa para acompañar las decisiones.',
    icon: IconChartBar,
    title: 'Reportes',
  },
]

export function DashboardHome() {
  return (
    <DashboardShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Panel operativo</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">Bienvenido a SIGAS</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-content-muted">
              Este es tu espacio de trabajo para gestionar la acción social de la Municipalidad de San Benito.
            </p>
          </div>
        </div>

        <section aria-labelledby="overview-title" className="mt-10">
          <div>
            <h2 className="text-xl font-bold text-content" id="overview-title">Resumen del sistema</h2>
            <p className="mt-1 text-sm text-content-muted">Módulos que formarán parte del circuito operativo.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {moduleCards.map(({ description, icon: Icon, title }) => (
              <article className="card border border-line bg-surface shadow-sm" key={title}>
                <div className="card-body gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-box bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="h-5 w-5" stroke={1.8} />
                    </span>
                    <span className="badge badge-ghost px-3 py-3 text-xs font-medium text-content-muted">Próximamente</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-content">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-content-muted">{description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="next-step-title" className="mt-8 rounded-box border border-primary/20 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-content">
              <IconSparkles aria-hidden="true" className="h-5 w-5" stroke={1.8} />
            </span>
            <div>
              <h2 className="font-bold text-content" id="next-step-title">Tu espacio está listo</h2>
              <p className="mt-1 text-sm leading-6 text-content-muted">
                Próximamente vas a poder operar cada módulo desde este panel con información centralizada y trazable.
              </p>
            </div>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
