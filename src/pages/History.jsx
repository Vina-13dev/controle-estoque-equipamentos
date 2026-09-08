import { useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { useUnits } from '../contexts/UnitContext'
import { listMovements } from '../services/movementsService'
import { formatDate, formatNumber, MOVEMENT_LABELS } from '../utils/helpers'

export default function History() {
  const { units, selectedUnitId } = useUnits()
  const [movements, setMovements] = useState([])
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!selectedUnitId) return
      setLoading(true)
      try {
        setMovements(await listMovements(selectedUnitId === 'all' ? null : selectedUnitId))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedUnitId])

  const unitName = (id) => units.find((u) => u.id === id)?.name || '-'
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movements.filter((m) => {
      if (type !== 'all' && m.type !== type) return false
      if (!q) return true
      return `${m.itemName} ${m.createdByName} ${m.note}`.toLowerCase().includes(q)
    })
  }, [movements, type, search])

  function exportCsv() {
    const rows = [
      ['Data', 'Tipo', 'Item', 'Unidade', 'Antes', 'Depois', 'Diferença', 'Registrado por', 'Observação'],
      ...filtered.map((m) => [
        formatDate(m.createdAt),
        MOVEMENT_LABELS[m.type],
        m.itemName,
        unitName(m.unitId),
        m.beforeQty,
        m.afterQty,
        m.delta,
        m.createdByName,
        m.note || '',
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historico-estoque-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <div className="page-title-row">
        <div><h1>Histórico</h1><p>Movimentações confirmadas não são editadas nem apagadas.</p></div>
        <button className="btn secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={17} /> Exportar CSV</button>
      </div>

      <div className="toolbar wrap">
        <label className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item, usuário ou observação..." /></label>
        <select className="toolbar-select" value={type} onChange={(e) => setType(e.target.value)}><option value="all">Todos os tipos</option><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste</option></select>
      </div>

      <div className="panel table-panel">
        {loading ? <div className="empty-inline">Carregando...</div> : filtered.length === 0 ? <div className="empty-state">Nenhuma movimentação encontrada.</div> : (
          <div className="responsive-table">
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Item</th>{selectedUnitId === 'all' && <th>Unidade</th>}<th>Alteração</th><th>Saldo</th><th>Registrado por</th><th>Observação</th></tr></thead>
              <tbody>{filtered.map((m) => <tr key={m.id}>
                <td>{formatDate(m.createdAt)}</td>
                <td><span className={`badge ${m.type}`}>{MOVEMENT_LABELS[m.type]}</span></td>
                <td><strong>{m.itemName}</strong></td>
                {selectedUnitId === 'all' && <td>{unitName(m.unitId)}</td>}
                <td><span className={`delta ${m.delta < 0 ? 'negative' : m.delta > 0 ? 'positive' : ''}`}>{m.delta > 0 ? '+' : ''}{formatNumber(m.delta)} {m.measure}</span></td>
                <td>{formatNumber(m.afterQty)} {m.measure}</td>
                <td>{m.createdByName || '-'}</td>
                <td className="note-cell">{m.note || '-'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
