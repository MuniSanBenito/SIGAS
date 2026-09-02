type BrandProps = {
  variant?: 'compact' | 'lockup-dark' | 'lockup-light'
}

export function Brand({ variant = 'compact' }: BrandProps) {
  if (variant === 'lockup-dark' || variant === 'lockup-light') {
    return (
      <div className="flex flex-col gap-3">
        <img
          alt="Municipalidad de San Benito"
          className="h-auto w-full max-w-xs object-contain object-left"
          src={variant === 'lockup-dark' ? '/logo-header-oscuro.webp' : '/logo-header-claro.webp'}
        />
        <div>
          <p className="text-lg font-bold leading-none tracking-tight">SIGAS</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-current/65">Sistema de Acción Social</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex items-center gap-3">
      <img alt="" className="h-11 w-11 shrink-0 rounded-box object-cover" src="/icon.webp" />
      <div>
        <p className="text-lg font-bold leading-none tracking-tight">SIGAS</p>
        <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-current/65">San Benito</p>
      </div>
    </div>
  )
}
