import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { subscribeResponsibles } from '../../services/responsiblesService'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import { Input } from '../../components/ui/Field'
import { useAuth } from '../../contexts/AuthContext'
import ResponsavelForm from './ResponsavelForm'

export default function ResponsaveisList() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => subscribeResponsibles(setItems), [])

  const filtered = useMemo(() => {
    if (!items) return []
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((r) => [r.name, r.sector, r.email].filter(Boolean).some((v) => v.toLowerCase().includes(term)))
  }, [items, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Responsáveis</h1>
          <p className="text-sm text-ink-faint">Pessoas que podem retirar ou usar equipamentos.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus size={16} /> Novo responsável
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input className="pl-9" placeholder="Buscar por nome, setor ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!items ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Nome', 'Setor', 'Cargo', 'Contato', 'Status', '']} />
          <tbody>
            {filtered.length === 0 && <EmptyState message="Nenhum responsável encontrado." />}
            {filtered.map((r) => (
              <TRow key={r.id}>
                <TCell className="font-medium text-ink">{r.name}</TCell>
                <TCell>{r.sector || '-'}</TCell>
                <TCell>{r.role || '-'}</TCell>
                <TCell>
                  <p>{r.phone || '-'}</p>
                  <p className="text-xs text-ink-faint">{r.email || ''}</p>
                </TCell>
                <TCell>
                  <Badge className={r.active ? 'bg-moss-50 text-moss-600' : 'bg-surface-base text-ink-faint'}>
                    {r.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TCell>
                <TCell>
                  {isAdmin && (
                    <button className="text-xs font-medium text-steel-500 hover:underline" onClick={() => { setEditing(r); setFormOpen(true) }}>
                      Editar
                    </button>
                  )}
                </TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}

      {formOpen && <ResponsavelForm open={formOpen} onClose={() => setFormOpen(false)} responsible={editing} />}
    </div>
  )
}
