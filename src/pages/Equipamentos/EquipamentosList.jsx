import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { subscribeEquipments } from '../../services/equipmentsService'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import { Input } from '../../components/ui/Field'
import { EQUIPMENT_STATUS_BADGE, EQUIPMENT_STATUS_LABEL } from '../../utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import EquipamentoForm from './EquipamentoForm'

export default function EquipamentosList() {
  const { isAdmin } = useAuth()
  const [equipments, setEquipments] = useState(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => subscribeEquipments(setEquipments), [])

  const filtered = useMemo(() => {
    if (!equipments) return []
    const term = search.trim().toLowerCase()
    if (!term) return equipments
    return equipments.filter((e) =>
      [e.name, e.assetTag, e.serialNumber, e.code].filter(Boolean).some((v) => v.toLowerCase().includes(term))
    )
  }, [equipments, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Equipamentos</h1>
          <p className="text-sm text-ink-faint">Cadastro e estoque de equipamentos.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus size={16} /> Novo equipamento
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, patrimônio ou série..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!equipments ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Nome', 'Patrimônio', 'Setor', 'Qtd.', 'Estoque mín.', 'Status', '']} />
          <tbody>
            {filtered.length === 0 && <EmptyState message="Nenhum equipamento encontrado." />}
            {filtered.map((eq) => (
              <TRow key={eq.id}>
                <TCell>
                  <p className="font-medium text-ink">{eq.name}</p>
                  <p className="mono-tag text-xs text-ink-faint">{eq.code}</p>
                </TCell>
                <TCell className="mono-tag text-ink-soft">{eq.assetTag || '-'}</TCell>
                <TCell>{eq.sector || '-'}</TCell>
                <TCell className={eq.quantity <= eq.minStock ? 'font-semibold text-brick-500' : ''}>
                  {eq.quantity}
                </TCell>
                <TCell>{eq.minStock}</TCell>
                <TCell>
                  <Badge className={EQUIPMENT_STATUS_BADGE[eq.status]}>{EQUIPMENT_STATUS_LABEL[eq.status]}</Badge>
                </TCell>
                <TCell>
                  {isAdmin && (
                    <button
                      className="text-xs font-medium text-steel-500 hover:underline"
                      onClick={() => { setEditing(eq); setFormOpen(true) }}
                    >
                      Editar
                    </button>
                  )}
                </TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}

      {formOpen && <EquipamentoForm open={formOpen} onClose={() => setFormOpen(false)} equipment={editing} />}
    </div>
  )
}
