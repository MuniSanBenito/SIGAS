import Link from 'next/link'

type ModulePlaceholderProps = {
  description: string
  title: string
}

export function ModulePlaceholder({ description, title }: ModulePlaceholderProps) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12" id="main-content">
      <Link className="text-sm font-semibold text-primary hover:underline" href="/">Volver al inicio</Link>
      <div className="mt-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Módulo operativo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-content sm:text-4xl">{title}</h1>
        <div className="mt-8 rounded-box border border-dashed border-line bg-surface p-6" role="status">
          <p className="font-semibold text-content">Este módulo estará disponible próximamente.</p>
          <p className="mt-2 text-sm leading-6 text-content-muted">{description}</p>
        </div>
      </div>
    </main>
  )
}
