export function Field({ label, required, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-soft">
        {label}
        {required && <span className="text-brick-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

const baseClass =
  'w-full rounded border border-ink/15 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-steel-500'

export function Input(props) {
  return <input className={baseClass} {...props} />
}

export function Textarea(props) {
  return <textarea className={`${baseClass} min-h-[80px]`} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className={baseClass} {...props}>
      {children}
    </select>
  )
}
