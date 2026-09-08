import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Loading from '../../components/ui/Loading'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Field'
import { formatDateTime } from '../../utils/formatters'

const ACTION_LABEL = {
  create: 'Criação',
  update: 'Alteração',
  movement: 'Movimentação',
  correction: 'Correção',
  maintenance: 'Manutenção',
  user_change: 'Alteração de usuário',
  permission_change: 'Alteração de permissão',
  settings_change: 'Alteração de configuração',
}

const ENTITY_LABEL = {
  equipment: 'Equipamento',
  responsible: 'Responsável',
  movement: 'Movimentação',
  maintenance: 'Manutenção',
  user: 'Usuário',
}

export default function Auditoria() {
  const [logs, setLogs] = useState(null)
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  const filtered = useMemo(() => {
    if (!logs) return []
    return logs.filter((l) => (!entityFilter || l.entity === entityFilter) && (!actionFilter || l.action === actionFilter))
  }, [logs, entityFilter, actionFilter])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Auditoria</h1>
        <p className="text-sm text-ink-faint">Log completo e somente-leitura de ações importantes do sistema.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-ink/8 bg-surface p-4 sm:grid-cols-4 sm:max-w-lg">
        <Field label="Entidade">
          <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ENTITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Ação">
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </div>

      {!logs ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Data', 'Usuário', 'Ação', 'Entidade', 'Descrição', '']} />
          <tbody>
            {filtered.length === 0 && <EmptyState />}
            {filtered.map((l) => (
              <TRow key={l.id}>
                <TCell className="whitespace-nowrap text-ink-faint">{formatDateTime(l.createdAt)}</TCell>
                <TCell>{l.userName}</TCell>
                <TCell><Badge className="bg-surface-base text-ink-soft">{ACTION_LABEL[l.action] || l.action}</Badge></TCell>
                <TCell>{ENTITY_LABEL[l.entity] || l.entity}</TCell>
                <TCell className="max-w-xs truncate">{l.description}</TCell>
                <TCell>
                  {(l.before || l.after) && (
                    <button className="text-xs font-medium text-steel-500 hover:underline" onClick={() => setViewing(l)}>
                      Ver dados
                    </button>
                  )}
                </TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Detalhes da auditoria"
        footer={<Button variant="secondary" onClick={() => setViewing(null)}>Fechar</Button>}
      >
        {viewing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-ink-faint">Dados anteriores</p>
              <pre className="max-h-64 overflow-auto rounded bg-surface-alt p-2 text-xs">{JSON.stringify(viewing.before, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-faint">Dados novos</p>
              <pre className="max-h-64 overflow-auto rounded bg-surface-alt p-2 text-xs">{JSON.stringify(viewing.after, null, 2)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
