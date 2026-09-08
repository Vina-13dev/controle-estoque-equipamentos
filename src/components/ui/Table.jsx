export function Table({ children }) {
  return (
    <div className="overflow-x-auto rounded-md border border-ink/8 bg-surface">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function THead({ columns }) {
  return (
    <thead>
      <tr className="border-b border-ink/8 bg-surface-alt text-left text-xs font-medium text-ink-faint">
        {columns.map((c) => (
          <th key={c} className="px-4 py-2.5 whitespace-nowrap">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function TRow({ children, className = '' }) {
  return <tr className={`border-b border-ink/6 last:border-0 hover:bg-surface-alt/60 ${className}`}>{children}</tr>
}

export function TCell({ children, className = '' }) {
  return <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>
}

export function EmptyState({ message = 'Nenhum registro encontrado.' }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-10 text-center text-sm text-ink-faint">
        {message}
      </td>
    </tr>
  )
}
