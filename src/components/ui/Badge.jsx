export default function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}
