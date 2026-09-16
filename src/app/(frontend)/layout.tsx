import type { Metadata } from 'next'
import Script from 'next/script'
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
  let stored = null;
  try {
    stored = localStorage.getItem('sigas-theme');
  } catch {}
  const theme = stored === 'sanbenito-light' || stored === 'sanbenito-dark'
    ? stored
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'sanbenito-dark' : 'sanbenito-light');
  document.documentElement.dataset.theme = theme;
})();`

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html data-theme="sanbenito-light" lang="es" suppressHydrationWarning>
      <body>
        <Script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          id="sigas-theme-init"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
