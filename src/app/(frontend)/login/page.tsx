import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Brand } from '../brand'
import { ThemeToggle } from '../theme-toggle'
import { LoginForm } from './login-form'

export const metadata = {
  description: 'Acceso interno al Sistema Integral de Gestión de Acción Social.',
  title: 'Ingresar | SIGAS',
}

export default async function LoginPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-page text-content">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)]">
        <section className="relative hidden overflow-hidden bg-sidebar px-12 py-12 text-[var(--c-sidebar-text)] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary/20" />
          <div className="absolute -bottom-40 -left-28 h-96 w-96 rounded-full border-[3rem] border-secondary/20" />
          <Brand variant="lockup-dark" />
          <div className="relative max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--c-sidebar-muted)]">
              Gestión social municipal
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-[var(--c-sidebar-text)]">
              Una gestión más ordenada para acompañar a cada familia.
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-[var(--c-sidebar-muted)]">
              Accedé a las herramientas internas de la Dirección de Acción Social.
            </p>
          </div>
          <p className="relative text-sm text-[var(--c-sidebar-muted)]">Municipalidad de San Benito</p>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-md">
            <div className="lg:hidden">
              <Brand variant="lockup-light" />
            </div>
            <div className="mt-12 rounded-box border border-line bg-surface p-6 shadow-xl shadow-brand-green-950/5 sm:p-8 lg:mt-0">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Acceso interno</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-content">Ingresar a SIGAS</h2>
              <p className="mt-3 text-sm leading-6 text-content-muted">
                Usá tu DNI y contraseña para ingresar al sistema.
              </p>
              <LoginForm />
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-content-muted">
              Sistema Integral de Gestión de Acción Social
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
