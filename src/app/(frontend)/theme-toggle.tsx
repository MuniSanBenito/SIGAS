'use client'

import { IconMoon, IconSun } from '@tabler/icons-react'
import { useState } from 'react'

const THEME_KEY = 'sigas-theme'
const LIGHT_THEME = 'sanbenito-light'
const DARK_THEME = 'sanbenito-dark'
type Theme = typeof LIGHT_THEME | typeof DARK_THEME

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.theme === DARK_THEME) return DARK_THEME
    return LIGHT_THEME
  })

  function toggleTheme() {
    const nextTheme = theme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem(THEME_KEY, nextTheme)
    setTheme(nextTheme)
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
