export default function Card({ children, className = '', accent }) {
  return (
    <div
      className={`bg-surface rounded-md border border-ink/8 p-4 ${accent ? `border-l-4 ${accent}` : ''} ${className}`}
    >
      {children}
    </div>
  )
}
