import { useEffect, useMemo, useState } from 'react'
import { Boxes, PackageCheck, Wrench, AlertTriangle, ArrowLeftRight, Clock } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Loading from '../components/ui/Loading'
import { subscribeEquipments } from '../services/equipmentsService'
import { subscribeMovements } from '../services/movementsService'
import { subscribeMaintenance } from '../services/maintenanceService'
import { EQUIPMENT_STATUS, MOVEMENT_TYPE_LABEL } from '../utils/constants'
import { formatDateTime, formatSequence } from '../utils/formatters'

function isToday(ts) {
  if (!ts?.toDate) return false
  const d = ts.toDate()
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export default function Dashboard() {
  const [equipments, setEquipments] = useState(null)
  const [movements, setMovements] = useState(null)
  const [maintenance, setMaintenance] = useState(null)

  useEffect(() => {
    const unsub1 = subscribeEquipments(setEquipments)
    const unsub2 = subscribeMovements(setMovements)
    const unsub3 = subscribeMaintenance(setMaintenance)
    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [])

  const stats = useMemo(() => {
    if (!equipments) return null
    const totalEquipments = equipments.length
    const availableStock = equipments.reduce((sum, e) => sum + (e.quantity || 0), 0)
    const inUse = equipments.filter((e) => e.status === EQUIPMENT_STATUS.EM_USO).length
    const inMaintenance = equipments.filter((e) => e.status === EQUIPMENT_STATUS.EM_MANUTENCAO).length
    const critical = equipments.filter((e) => (e.quantity || 0) <= (e.minStock || 0)).length
    const todayMovements = (movements || []).filter((m) => isToday(m.createdAt)).length
    return { totalEquipments, availableStock, inUse, inMaintenance, critical, todayMovements }
  }, [equipments, movements])

  if (!stats) return <Loading label="Carregando painel..." />

  const cards = [
    { label: 'Total de equipamentos', value: stats.totalEquipments, icon: Boxes, accent: 'border-steel-500' },
    { label: 'Estoque disponível', value: stats.availableStock, icon: PackageCheck, accent: 'border-moss-500' },
    { label: 'Em uso', value: stats.inUse, icon: ArrowLeftRight, accent: 'border-steel-500' },
    { label: 'Em manutenção', value: stats.inMaintenance, icon: Wrench, accent: 'border-amber-500' },
    { label: 'Estoque crítico', value: stats.critical, icon: AlertTriangle, accent: 'border-brick-500' },
    { label: 'Movimentações hoje', value: stats.todayMovements, icon: Clock, accent: 'border-steel-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Painel</h1>
        <p className="text-sm text-ink-faint">Visão geral do estoque de equipamentos.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} accent={accent}>
            <Icon size={16} className="mb-2 text-ink-faint" />
            <p className="text-2xl font-semibold text-ink">{value}</p>
            <p className="text-xs text-ink-faint">{label}</p>
          </Card>
        ))}
      </div>

      {stats.critical > 0 && (
        <Card accent="border-brick-500" className="bg-brick-50/40">
          <p className="text-sm text-brick-600">
            {stats.critical} equipamento(s) estão no estoque mínimo ou abaixo dele. Verifique a lista de equipamentos.
          </p>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Movimentações recentes</h2>
        <Card className="p-0">
          {(movements || []).slice(0, 8).map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-ink/6 px-4 py-2.5 text-sm last:border-0">
              <div>
                <p className="text-ink">
                  <span className="mono-tag text-ink-faint">{formatSequence(m.sequence)}</span>{' '}
                  {MOVEMENT_TYPE_LABEL[m.type]} · {m.equipmentName}
                </p>
                <p className="text-xs text-ink-faint">{formatDateTime(m.createdAt)} · {m.createdByName}</p>
              </div>
              <Badge className="bg-surface-base text-ink-soft">{m.quantity}</Badge>
            </div>
          ))}
          {(movements || []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">Nenhuma movimentação registrada ainda.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
