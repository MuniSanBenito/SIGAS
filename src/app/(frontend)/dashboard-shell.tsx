'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { IconHome, IconLogout, IconMenu2, IconX } from '@tabler/icons-react'

import { Brand } from './brand'
import { ThemeToggle } from './theme-toggle'

type DashboardShellProps = { children: ReactNode }

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isMenuOpen) return
    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return
      const focusableElements = Array.from(document.querySelectorAll<HTMLElement>('#mobile-menu a[href], #mobile-menu button:not([disabled])'))
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (!firstElement || !lastElement) return
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  async function handleLogout() {
    if (isLoggingOut) return
    setLogoutError(null)
    setIsLoggingOut(true)
    try {
      const response = await fetch('/api/users/logout', { credentials: 'same-origin', method: 'POST' })
      if (!response.ok) throw new Error('Logout failed')
      router.replace('/login')
      router.refresh()
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Intentá nuevamente.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  function closeMenu() {
    setIsMenuOpen(false)
    menuButtonRef.current?.focus()
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-content lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside aria-label="Navegación principal" className="hidden min-h-screen flex-col border-r border-[var(--c-sidebar-border)] bg-sidebar text-[var(--c-sidebar-text)] lg:flex">
        <SidebarHeader />
        <nav aria-label="Secciones del sistema" className="flex-1 px-4 py-6"><NavigationLink active /></nav>
        <div className="border-t border-[var(--c-sidebar-border)] p-4">
          <div className="mb-2 flex justify-end"><ThemeToggle /></div>
          <LogoutButton isLoggingOut={isLoggingOut} onClick={handleLogout} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 lg:hidden">
          <SidebarHeader compact />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button aria-controls="mobile-menu" aria-expanded={isMenuOpen} aria-label="Abrir menú" className="btn btn-square btn-ghost min-h-11 min-w-11 text-content" onClick={() => setIsMenuOpen(true)} ref={menuButtonRef} type="button">
              <IconMenu2 aria-hidden="true" className="h-6 w-6" stroke={1.8} />
            </button>
          </div>
        </header>

        {isMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button aria-label="Cerrar menú lateral" className="absolute inset-0 h-full w-full cursor-default bg-brand-neutral-950/50" onClick={closeMenu} tabIndex={-1} type="button" />
            <aside aria-label="Menú principal" aria-modal="true" className="relative flex h-full w-[min(18rem,calc(100%-3rem))] flex-col bg-sidebar text-[var(--c-sidebar-text)] shadow-2xl" id="mobile-menu" role="dialog">
              <div className="flex items-center justify-between border-b border-[var(--c-sidebar-border)] px-5 py-4">
                <SidebarHeader />
                <button aria-label="Cerrar menú" className="btn btn-square btn-ghost min-h-11 min-w-11 text-[var(--c-sidebar-text)] hover:bg-[var(--c-nav-hover)]" onClick={closeMenu} ref={closeButtonRef} type="button">
                  <IconX aria-hidden="true" className="h-5 w-5" stroke={1.8} />
                </button>
              </div>
              <nav aria-label="Secciones del sistema" className="flex-1 px-4 py-6"><NavigationLink active onClick={closeMenu} /></nav>
              <div className="border-t border-[var(--c-sidebar-border)] p-4"><LogoutButton isLoggingOut={isLoggingOut} onClick={handleLogout} /></div>
            </aside>
          </div>
        )}

        {logoutError && <p className="mx-auto mt-6 max-w-7xl rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error sm:mx-6 lg:mx-10" role="alert">{logoutError}</p>}
        {children}
      </div>
    </div>
  )
}

function SidebarHeader({ compact = false }: { compact?: boolean }) {
  return <div className={`${compact ? 'px-1' : 'px-5 py-6'} text-[var(--c-sidebar-text)]`}><Brand /></div>
}

function NavigationLink({ active = false, onClick }: { active?: boolean; onClick?: () => void }) {
  return <Link aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-box px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-l-2 border-[var(--c-nav-active-border)] bg-[var(--c-nav-active)] text-[var(--c-sidebar-text)]' : 'text-[var(--c-sidebar-muted)] hover:bg-[var(--c-nav-hover)] hover:text-[var(--c-sidebar-text)]'}`} href="/" onClick={onClick}><IconHome aria-hidden="true" className="h-5 w-5" stroke={1.8} />Inicio</Link>
}

function LogoutButton({ isLoggingOut, onClick }: { isLoggingOut: boolean; onClick: () => void }) {
  return <button className="flex min-h-11 w-full items-center gap-3 rounded-box px-4 py-3 text-left text-sm font-semibold text-[var(--c-sidebar-muted)] transition-colors hover:bg-[var(--c-nav-hover)] hover:text-[var(--c-sidebar-text)] disabled:cursor-wait disabled:opacity-60" disabled={isLoggingOut} onClick={onClick} type="button"><IconLogout aria-hidden="true" className="h-5 w-5" stroke={1.8} />{isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
}
