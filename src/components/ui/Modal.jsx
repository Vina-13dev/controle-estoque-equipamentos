import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} rounded-md bg-surface shadow-lg`}>
        <div className="flex items-center justify-between border-b border-ink/8 px-5 py-3.5">
          <h2 className="font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink/8 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}
