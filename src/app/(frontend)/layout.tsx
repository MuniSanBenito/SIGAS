import type { Metadata } from 'next'
import React from 'react'

import './styles.css'

export const metadata: Metadata = {
  description: 'Sistema Integral de Gestión de Acción Social de la Municipalidad de San Benito.',
  icons: {
    apple: '/icon.webp',
    icon: '/icon.webp',
  },
  title: 'SIGAS | Municipalidad de San Benito',
}

const themeScript = `(() => {
  const key = 'sigas-theme';
  const stored = localStorage.getItem(key);
  const theme = stored === 'sanbenito-light' || stored === 'sanbenito-dark'
    ? stored
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'sanbenito-dark' : 'sanbenito-light');
  document.documentElement.dataset.theme = theme;
})();`

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
