import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { subscribeMovements } from '../../services/movementsService'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import { MOVEMENT_TYPE_LABEL } from '../../utils/constants'
import { formatDateTime, formatSequence } from '../../utils/formatters'
import MovimentacaoForm from './MovimentacaoForm'
import CorrecaoForm from './CorrecaoForm'

const TYPE_BADGE = {
  entrada: 'bg-moss-50 text-moss-600',
  devolucao: 'bg-moss-50 text-moss-600',
  saida: 'bg-steel-50 text-steel-600',
  baixa: 'bg-brick-50 text-brick-600',
  ajuste: 'bg-amber-50 text-amber-600',
  correcao: 'bg-amber-50 text-amber-600',
}

export default function Movimentacoes() {
  const [movements, setMovements] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [correcting, setCorrecting] = useState(null)

  useEffect(() => subscribeMovements(setMovements), [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Movimentações</h1>
          <p className="text-sm text-ink-faint">Registro imutável de entradas, saídas, devoluções e baixas.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Nova movimentação
        </Button>
      </div>

      {!movements ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Nº', 'Tipo', 'Equipamento', 'Qtd.', 'Responsável', 'Registrado por', 'Data', '']} />
          <tbody>
            {movements.length === 0 && <EmptyState message="Nenhuma movimentação registrada." />}
            {movements.map((m) => (
              <TRow key={m.id}>
                <TCell className="mono-tag text-ink-faint">{formatSequence(m.sequence)}</TCell>
                <TCell>
                  <Badge className={TYPE_BADGE[m.type]}>{MOVEMENT_TYPE_LABEL[m.type]}</Badge>
                  {m.relatedMovementId && (
                    <p className="mt-1 text-xs text-ink-faint">ref. {formatSequence(m.relatedMovementSequence)}</p>
                  )}
                </TCell>
                <TCell>{m.equipmentName}</TCell>
                <TCell>{m.quantity}</TCell>
                <TCell>{m.responsibleName || '-'}</TCell>
                <TCell>{m.createdByName}</TCell>
                <TCell className="whitespace-nowrap text-ink-faint">{formatDateTime(m.createdAt)}</TCell>
                <TCell>
                  {m.type !== 'correcao' && (
                    <button className="text-xs font-medium text-amber-600 hover:underline" onClick={() => setCorrecting(m)}>
                      Corrigir
                    </button>
                  )}
                </TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}

      {formOpen && <MovimentacaoForm open={formOpen} onClose={() => setFormOpen(false)} />}
      {correcting && <CorrecaoForm open={!!correcting} onClose={() => setCorrecting(null)} movement={correcting} />}
    </div>
  )
}
