import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { subscribeEquipments } from '../../services/equipmentsService'
import { subscribeMovements } from '../../services/movementsService'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import { EQUIPMENT_STATUS, EQUIPMENT_STATUS_LABEL, MOVEMENT_TYPE_LABEL } from '../../utils/constants'
import { formatDateTime } from '../../utils/formatters'

const REPORTS = [
  { id: 'estoque_atual', label: 'Estoque atual' },
  { id: 'disponiveis', label: 'Disponíveis' },
  { id: 'em_uso', label: 'Em uso' },
  { id: 'em_manutencao', label: 'Em manutenção' },
  { id: 'movimentacoes', label: 'Histórico de movimentações' },
]

// Exportação simples para CSV, já funcional hoje. A estrutura dos dados é a
// mesma que será usada para gerar PDF/Excel no futuro (ver README - Pendências).
function exportCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(';')
  const lines = rows.map((r) => columns.map((c) => `"${(r[c.key] ?? '').toString().replace(/"/g, '""')}"`).join(';'))
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Relatorios() {
  const [equipments, setEquipments] = useState(null)
  const [movements, setMovements] = useState(null)
  const [selected, setSelected] = useState('estoque_atual')

  useEffect(() => subscribeEquipments(setEquipments), [])
  useEffect(() => subscribeMovements(setMovements), [])

  const rows = useMemo(() => {
    if (!equipments) return []
    if (selected === 'estoque_atual') return equipments
    if (selected === 'disponiveis') return equipments.filter((e) => e.status === EQUIPMENT_STATUS.DISPONIVEL)
    if (selected === 'em_uso') return equipments.filter((e) => e.status === EQUIPMENT_STATUS.EM_USO)
    if (selected === 'em_manutencao') return equipments.filter((e) => e.status === EQUIPMENT_STATUS.EM_MANUTENCAO)
    return []
  }, [equipments, selected])

  if (!equipments || !movements) return <Loading />

  const isMovementReport = selected === 'movimentacoes'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Relatórios</h1>
        <p className="text-sm text-ink-faint">Exportação em CSV disponível agora; PDF/Excel formatado ficará para uma próxima versão.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={`rounded px-3 py-1.5 text-sm ${selected === r.id ? 'bg-steel-500 text-white' : 'bg-surface-base text-ink-soft'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() =>
            isMovementReport
              ? exportCsv('movimentacoes.csv', movements, [
                  { key: 'sequence', label: 'Nº' },
                  { key: 'type', label: 'Tipo' },
                  { key: 'equipmentName', label: 'Equipamento' },
                  { key: 'quantity', label: 'Quantidade' },
                  { key: 'responsibleName', label: 'Responsável' },
                  { key: 'sector', label: 'Setor' },
                  { key: 'createdByName', label: 'Registrado por' },
                ])
              : exportCsv(`${selected}.csv`, rows, [
                  { key: 'name', label: 'Nome' },
                  { key: 'assetTag', label: 'Patrimônio' },
                  { key: 'sector', label: 'Setor' },
                  { key: 'quantity', label: 'Quantidade' },
                  { key: 'minStock', label: 'Estoque mínimo' },
                  { key: 'status', label: 'Status' },
                ])
          }
        >
          <Download size={16} /> Exportar CSV
        </Button>
      </div>

      {isMovementReport ? (
        <Table>
          <THead columns={['Nº', 'Tipo', 'Equipamento', 'Qtd.', 'Responsável', 'Setor', 'Registrado por', 'Data']} />
          <tbody>
            {movements.length === 0 && <EmptyState />}
            {movements.map((m) => (
              <TRow key={m.id}>
                <TCell className="mono-tag">{m.sequence}</TCell>
                <TCell>{MOVEMENT_TYPE_LABEL[m.type]}</TCell>
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
      ) : (
        <Table>
          <THead columns={['Nome', 'Patrimônio', 'Setor', 'Quantidade', 'Estoque mínimo', 'Status']} />
          <tbody>
            {rows.length === 0 && <EmptyState />}
            {rows.map((e) => (
              <TRow key={e.id}>
                <TCell className="font-medium text-ink">{e.name}</TCell>
                <TCell className="mono-tag">{e.assetTag || '-'}</TCell>
                <TCell>{e.sector || '-'}</TCell>
                <TCell>{e.quantity}</TCell>
                <TCell>{e.minStock}</TCell>
                <TCell>{EQUIPMENT_STATUS_LABEL[e.status]}</TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
