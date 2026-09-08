import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Boxes,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  ShieldCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitContext'

const baseLinks = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/movimentar', label: 'Movimentar', icon: PackagePlus },
  { to: '/historico', label: 'Histórico', icon: History },
]

export default function Layout() {
  const { profile, isAdmin, logout } = useAuth()
  const { units, selectedUnitId, setSelectedUnitId } = useUnits()
  const [open, setOpen] = useState(false)

  const links = isAdmin
    ? [
        ...baseLinks,
        { to: '/admin/usuarios', label: 'Usuários', icon: Users },
        { to: '/admin/unidades', label: 'Unidades', icon: ShieldCheck },
      ]
    : baseLinks

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-icon"><Boxes size={20} /></span>
          <div>
            <strong>Controle de Estoque</strong>
            <small>Assistência Social</small>
          </div>
          <button className="mobile-close" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>

        <nav className="nav-list">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{(profile?.name || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="sidebar-user-info">
            <strong>{profile?.name || 'Usuário'}</strong>
            <small>{isAdmin ? 'Administrador' : 'Operador'}</small>
          </div>
          <button className="icon-button" onClick={logout} title="Sair"><LogOut size={18} /></button>
        </div>
      </aside>

      {open && <button className="sidebar-overlay" onClick={() => setOpen(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="unit-control">
            <label>Unidade</label>
            <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
              {isAdmin && <option value="all">Todas as unidades</option>}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>
          <div className="topbar-user">
            <span>{profile?.name}</span>
          </div>
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  )
}
