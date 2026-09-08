import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Boxes,
  Users,
  ArrowLeftRight,
  History,
  ShieldCheck,
  Wrench,
  FileBarChart,
  UserCog,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/movimentacao-rapida', label: 'Movimentação rápida', icon: Zap },
  { to: '/equipamentos', label: 'Equipamentos', icon: Boxes },
  { to: '/responsaveis', label: 'Responsáveis', icon: Users },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck, adminOnly: true },
  { to: '/usuarios', label: 'Usuários', icon: UserCog, adminOnly: true },
]

export default function Sidebar({ onNavigate }) {
  const { isAdmin } = useAuth()
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 px-2 py-2">
        <p className="text-sm font-semibold text-ink">Controle de Estoque</p>
        <p className="text-xs text-ink-faint">Equipamentos</p>
      </div>
      {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-steel-50 text-steel-600 font-medium' : 'text-ink-soft hover:bg-surface-base'
            }`
          }
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
