import { useEffect, useMemo, useState } from 'react'
import { subscribeMovements } from '../../services/movementsService'
import { subscribeEquipments } from '../../services/equipmentsService'
import { subscribeResponsibles } from '../../services/responsiblesService'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import { Field, Select, Input } from '../../components/ui/Field'
import { MOVEMENT_TYPE_LABEL } from '../../utils/constants'
import { formatDateTime, formatSequence } from '../../utils/formatters'

export default function Historico() {
  const [movements, setMovements] = useState(null)
  const [equipments, setEquipments] = useState([])
  const [responsibles, setResponsibles] = useState([])

  const [filters, setFilters] = useState({ type: '', equipmentId: '', responsibleId: '', sector: '', from: '', to: '' })

  useEffect(() => subscribeMovements(setMovements), [])
  useEffect(() => subscribeEquipments(setEquipments), [])
  useEffect(() => subscribeResponsibles(setResponsibles), [])

  function set(field, value) {
    setFilters((f) => ({ ...f, [field]: value }))
  }

  const filtered = useMemo(() => {
    if (!movements) return []
    return movements.filter((m) => {
      if (filters.type && m.type !== filters.type) return false
      if (filters.equipmentId && m.equipmentId !== filters.equipmentId) return false
      if (filters.responsibleId && m.responsibleId !== filters.responsibleId) return false
      if (filters.sector && !(m.sector || '').toLowerCase().includes(filters.sector.toLowerCase())) return false
      if (filters.from && m.createdAt?.toDate && m.createdAt.toDate() < new Date(filters.from)) return false
      if (filters.to && m.createdAt?.toDate && m.createdAt.toDate() > new Date(filters.to + 'T23:59:59')) return false
      return true
    })
  }, [movements, filters])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Histórico</h1>
        <p className="text-sm text-ink-faint">Todas as movimentações, com filtros.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-ink/8 bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Tipo">
          <Select value={filters.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(MOVEMENT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Equipamento">
          <Select value={filters.equipmentId} onChange={(e) => set('equipmentId', e.target.value)}>
            <option value="">Todos</option>
            {equipments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
        <Field label="Responsável">
          <Select value={filters.responsibleId} onChange={(e) => set('responsibleId', e.target.value)}>
            <option value="">Todos</option>
            {responsibles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Setor">
          <Input value={filters.sector} onChange={(e) => set('sector', e.target.value)} />
        </Field>
        <Field label="De">
          <Input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </Field>
      </div>

      {!movements ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Nº', 'Tipo', 'Equipamento', 'Qtd.', 'Responsável', 'Setor', 'Usuário', 'Data']} />
          <tbody>
            {filtered.length === 0 && <EmptyState />}
            {filtered.map((m) => (
              <TRow key={m.id}>
                <TCell className="mono-tag text-ink-faint">{formatSequence(m.sequence)}</TCell>
                <TCell><Badge className="bg-surface-base text-ink-soft">{MOVEMENT_TYPE_LABEL[m.type]}</Badge></TCell>
                <TCell>{m.equipmentName}</TCell>
                <TCell>{m.quantity}</TCell>
                <TCell>{m.responsibleName || '-'}</TCell>
                <TCell>{m.sector || '-'}</TCell>
                <TCell>{m.createdByName}</TCell>
                <TCell className="whitespace-nowrap text-ink-faint">{formatDateTime(m.createdAt)}</TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
