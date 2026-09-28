'use client'

import { FormEvent, useState } from 'react'

import { AccountError } from '@/account/errors'
import { parseChangePasswordInput } from '@/account/validation'

import { AppDialog, AppDialogBody, AppDialogFooter } from './app-dialog'

type ChangePasswordDialogProps = {
  onClose: () => void
  onSaved: () => void
}

export function ChangePasswordDialog({ onClose, onSaved }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setError(null)
    try {
      parseChangePasswordInput({ confirmPassword, currentPassword, newPassword })
    } catch (validationError) {
      setError(validationError instanceof AccountError ? validationError.message : 'Revisá los datos ingresados.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/cuenta/contrasena', {
        body: JSON.stringify({ confirmPassword, currentPassword, newPassword }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(body?.error?.message ?? 'No se pudo cambiar la contraseña.')
      }
      onSaved()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppDialog
      description="Vas a seguir con la sesión iniciada. La próxima vez ingresá con la contraseña nueva."
      onClose={onClose}
      size="md"
      title="Cambiar contraseña"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <AppDialogBody>
          <div className="space-y-5">
            <PasswordField
              autoComplete="current-password"
              id="current-password"
              label="Contraseña actual"
              onChange={setCurrentPassword}
              value={currentPassword}
            />
            <PasswordField
              autoComplete="new-password"
              describedBy="new-password-help"
              id="new-password"
              label="Nueva contraseña"
              minLength={8}
              onChange={setNewPassword}
              value={newPassword}
            />
            <p className="-mt-3 text-sm text-content-muted" id="new-password-help">
              Usá al menos 8 caracteres.
            </p>
            <PasswordField
              autoComplete="new-password"
              id="confirm-password"
              label="Confirmar contraseña"
              onChange={setConfirmPassword}
              value={confirmPassword}
            />
            {error && (
              <p className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <button className="btn btn-ghost min-h-11" disabled={isSubmitting} onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn btn-primary min-h-11" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </AppDialogFooter>
      </form>
    </AppDialog>
  )
}

function PasswordField({
  autoComplete,
  describedBy,
  id,
  label,
  minLength,
  onChange,
  value,
}: {
  autoComplete: string
  describedBy?: string
  id: string
  label: string
  minLength?: number
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="block space-y-2" htmlFor={id}>
      <span className="text-sm font-semibold text-content">{label}</span>
      <input
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        className="input input-bordered h-12 w-full bg-surface text-content"
        id={id}
        maxLength={128}
        minLength={minLength}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        required
        type="password"
        value={value}
      />
    </label>
  )
}
