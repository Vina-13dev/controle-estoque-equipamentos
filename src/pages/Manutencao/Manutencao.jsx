import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { subscribeMaintenance, updateMaintenance } from '../../services/maintenanceService'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import { Select } from '../../components/ui/Field'
import { MAINTENANCE_STATUS_LABEL } from '../../utils/constants'
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import ManutencaoForm from './ManutencaoForm'

const STATUS_BADGE = {
  aberta: 'bg-amber-50 text-amber-600',
  em_manutencao: 'bg-steel-50 text-steel-600',
  aguardando_peca: 'bg-amber-50 text-amber-600',
  finalizada: 'bg-moss-50 text-moss-600',
  cancelada: 'bg-surface-base text-ink-faint',
}

export default function Manutencao() {
  const { profile, firebaseUser, isAdmin } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => subscribeMaintenance(setItems), [])

  async function handleStatusChange(item, status) {
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    try {
      await updateMaintenance(item.id, { status }, item.equipmentId, user)
      toast.success('Status atualizado.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível atualizar o status.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Manutenção</h1>
          <p className="text-sm text-ink-faint">Controle de equipamentos em manutenção.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Abrir manutenção
        </Button>
      </div>

      {!items ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Equipamento', 'Problema', 'Técnico', 'Custo', 'Previsão', 'Status', 'Aberta em']} />
          <tbody>
            {items.length === 0 && <EmptyState message="Nenhuma manutenção registrada." />}
            {items.map((m) => (
              <TRow key={m.id}>
                <TCell className="font-medium text-ink">{m.equipmentName}</TCell>
                <TCell className="max-w-xs truncate">{m.problem}</TCell>
                <TCell>{m.technician || '-'}</TCell>
                <TCell>{formatCurrency(m.cost)}</TCell>
                <TCell>{m.expectedReturnDate ? formatDate(m.expectedReturnDate) : '-'}</TCell>
                <TCell>
                  {isAdmin ? (
                    <Select value={m.status} onChange={(e) => handleStatusChange(m, e.target.value)} className="!py-1 text-xs">
                      {Object.entries(MAINTENANCE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  ) : (
                    <Badge className={STATUS_BADGE[m.status]}>{MAINTENANCE_STATUS_LABEL[m.status]}</Badge>
                  )}
                </TCell>
                <TCell className="whitespace-nowrap text-ink-faint">{formatDateTime(m.createdAt)}</TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}

      {formOpen && <ManutencaoForm open={formOpen} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
