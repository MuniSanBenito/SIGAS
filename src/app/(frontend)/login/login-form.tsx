'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { normalizeDni } from '@/normalizeDni'

const INVALID_CREDENTIALS_MESSAGE = 'Las credenciales ingresadas no son válidas.'

export function LoginForm() {
  const router = useRouter()
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    setError(null)

    let normalizedDni: string
    try {
      normalizedDni = normalizeDni(dni)
    } catch {
      setError('Ingresá un DNI válido usando solo números, puntos, espacios o guiones.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/users/login', {
        body: JSON.stringify({ password, username: normalizedDni }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(INVALID_CREDENTIALS_MESSAGE)
      }

      router.replace('/')
      router.refresh()
    } catch {
      setError(INVALID_CREDENTIALS_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-content" htmlFor="dni">
          DNI
        </label>
        <input
          aria-describedby="dni-help"
          aria-invalid={error ? true : undefined}
          autoComplete="username"
          className="input input-bordered h-12 w-full bg-surface text-content placeholder:text-content-muted focus:border-primary focus:outline-primary"
          id="dni"
          inputMode="numeric"
          name="username"
          onChange={(event) => setDni(event.target.value)}
          placeholder="Ej. 30123456"
          required
          type="text"
          value={dni}
        />
      
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-content" htmlFor="password">
          Contraseña
        </label>
        <input
          autoComplete="current-password"
          className="input input-bordered h-12 w-full bg-surface text-content placeholder:text-content-muted focus:border-primary focus:outline-primary"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ingresá tu contraseña"
          required
          type="password"
          value={password}
        />
      </div>

      {error && (
        <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="btn btn-primary h-12 min-h-12 w-full text-base font-semibold shadow-none"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
