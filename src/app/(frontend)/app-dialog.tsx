'use client'

import { IconX } from '@tabler/icons-react'
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'

const SIZE_CLASS = {
  md: 'sm:!max-w-lg',
  lg: 'sm:!max-w-2xl',
  xl: 'sm:!max-w-4xl',
} as const

type AppDialogProps = {
  children: ReactNode
  description?: string
  eyebrow?: string
  onClose: () => void
  size?: keyof typeof SIZE_CLASS
  title: string
}

export function AppDialog({
  children,
  description,
  eyebrow,
  onClose,
  size = 'lg',
  title,
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useLayoutEffect(() => {
    const node = dialogRef.current
    if (!node) return

    let ignoreClose = false
    if (!node.open) node.showModal()

    const handleClose = () => {
      if (!ignoreClose) onCloseRef.current()
    }
    node.addEventListener('close', handleClose)

    const firstField = node.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
    )
    firstField?.focus()

    return () => {
      ignoreClose = true
      node.removeEventListener('close', handleClose)
    }
  }, [])

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="modal modal-bottom sm:modal-middle"
      ref={dialogRef}
    >
      <div
        className={`modal-box flex w-full flex-col !overflow-hidden border border-line bg-surface !p-0 shadow-lg !max-h-[min(44rem,calc(100dvh-0.75rem))] sm:!max-h-[min(44rem,calc(100dvh-2rem))] ${SIZE_CLASS[size]}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0 pt-0.5">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
            ) : null}
            <h2 className={`${eyebrow ? 'mt-1' : ''} text-lg font-bold text-content sm:text-xl`} id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-content-muted" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Cerrar"
            className="btn btn-ghost btn-square min-h-11 min-w-11 shrink-0"
            onClick={onClose}
            type="button"
          >
            <IconX aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button type="submit">Cerrar</button>
      </form>
    </dialog>
  )
}

export function AppDialogBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
  )
}

export function AppDialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-line bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 [&>button]:w-full sm:[&>button]:w-auto">
      {children}
    </div>
  )
}
