import { useState } from 'react'
import { Menu, LogOut, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Header({ onMenuClick }) {
  const { profile, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="flex h-14 items-center justify-between border-b border-ink/8 bg-surface px-4">
      <button onClick={onMenuClick} className="text-ink-soft md:hidden">
        <Menu size={22} />
      </button>
      <div className="hidden md:block" />
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-base"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-steel-50 text-steel-600">
            <User size={15} />
          </span>
          <span className="hidden text-ink-soft sm:inline">{profile?.name || profile?.email}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-48 rounded-md border border-ink/8 bg-surface py-1 shadow-md">
            <div className="border-b border-ink/8 px-3 py-2">
              <p className="truncate text-sm font-medium text-ink">{profile?.name}</p>
              <p className="truncate text-xs text-ink-faint">{profile?.role === 'admin' ? 'Administrador' : 'Operador'}</p>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-brick-500 hover:bg-brick-50"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
