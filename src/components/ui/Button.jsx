import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-steel-500 text-white hover:bg-steel-600 disabled:bg-steel-400/60',
  secondary: 'bg-surface-base text-ink hover:bg-surface-base/70 border border-ink/10',
  danger: 'bg-brick-500 text-white hover:bg-brick-600 disabled:bg-brick-500/60',
  ghost: 'text-ink-soft hover:bg-surface-base',
}

export default function Button({ variant = 'primary', loading, disabled, children, className = '', ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}
