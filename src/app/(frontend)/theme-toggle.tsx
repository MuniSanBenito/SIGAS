'use client'

import { IconMoon, IconSun } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

const THEME_KEY = 'sigas-theme'
const THEME_CHANGE_EVENT = 'sigas-theme-change'
const LIGHT_THEME = 'sanbenito-light'
const DARK_THEME = 'sanbenito-dark'
type Theme = typeof LIGHT_THEME | typeof DARK_THEME

function getDocumentTheme(): Theme {
  return document.documentElement.dataset.theme === DARK_THEME ? DARK_THEME : LIGHT_THEME
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(LIGHT_THEME)

  useEffect(() => {
    const syncTheme = () => setTheme(getDocumentTheme())
    syncTheme()
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncTheme)
  }, [])

  function toggleTheme() {
    const nextTheme = getDocumentTheme() === LIGHT_THEME ? DARK_THEME : LIGHT_THEME
    document.documentElement.dataset.theme = nextTheme
    try {
      window.localStorage.setItem(THEME_KEY, nextTheme)
    } catch {}
    setTheme(nextTheme)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  const isDark = theme === DARK_THEME

  return (
    <button
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-pressed={isDark}
      className="btn btn-square btn-ghost min-h-11 min-w-11 text-current"
      onClick={toggleTheme}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      type="button"
    >
      {isDark ? <IconSun aria-hidden="true" className="h-5 w-5" stroke={1.8} /> : <IconMoon aria-hidden="true" className="h-5 w-5" stroke={1.8} />}
    </button>
  )
}
