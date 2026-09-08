import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, Search, X } from 'lucide-react'
import { useUnits } from '../contexts/UnitContext'
import { listItems } from '../services/itemsService'
import { listMovements } from '../services/movementsService'
import { formatDate, formatNumber, MOVEMENT_LABELS } from '../utils/helpers'

function movementDate(value) {
  if (!value) return null
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function History() {
  const { units, selectedUnitId } = useUnits()
  const [movements, setMovements] = useState([])
  const [items, setItems] = useState([])
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!selectedUnitId) return
      setLoading(true)
      try {
        const unitId = selectedUnitId === 'all' ? null : selectedUnitId
        const [movementData, itemData] = await Promise.all([
          listMovements(unitId),
          listItems(unitId),
        ])
        setMovements(movementData)
        setItems(itemData)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedUnitId])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const movementCategory = (movement) => movement.itemCategory || itemById.get(movement.itemId)?.category || ''
  const unitName = (id) => units.find((u) => u.id === id)?.name || '-'

  const categories = useMemo(() => {
    const set = new Set()
    movements.forEach((movement) => {
      const value = movement.itemCategory || itemById.get(movement.itemId)?.category || ''
      if (value.trim()) set.add(value.trim())
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [movements, itemById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null

    return movements.filter((m) => {
      if (type !== 'all' && m.type !== type) return false

      const itemCategory = movementCategory(m)
      if (category !== 'all' && itemCategory !== category) return false

      const date = movementDate(m.createdAt)
      if (start && (!date || date < start)) return false
      if (end && (!date || date > end)) return false

      if (!q) return true
      return `${m.itemName} ${itemCategory} ${m.createdByName} ${m.note}`.toLowerCase().includes(q)
    })
  }, [movements, type, category, startDate, endDate, search, itemById])

  const hasFilters = type !== 'all' || category !== 'all' || startDate || endDate || search

  function clearFilters() {
    setType('all')
    setCategory('all')
    setStartDate('')
    setEndDate('')
    setSearch('')
  }

  function exportCsv() {
    const rows = [
      ['Data', 'Tipo', 'Item', 'Categoria', 'Unidade', 'Antes', 'Depois', 'Diferença', 'Registrado por', 'Observação'],
      ...filtered.map((m) => [
        formatDate(m.createdAt),
        MOVEMENT_LABELS[m.type],
        m.itemName,
        movementCategory(m) || '-',
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
    a.download = `relatorio-estoque-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printReport() {
    if (!filtered.length) return

    const selectedUnitName = selectedUnitId === 'all'
      ? 'Todas as unidades'
      : unitName(selectedUnitId)

    const filterLines = [
      `Unidade: ${selectedUnitName}`,
      `Tipo: ${type === 'all' ? 'Todos' : MOVEMENT_LABELS[type]}`,
      `Categoria: ${category === 'all' ? 'Todas' : category}`,
      `Período: ${startDate || 'início'} até ${endDate || 'hoje'}`,
      `Registros: ${filtered.length}`,
    ]

    const rows = filtered.map((m) => `
      <tr>
        <td>${escapeHtml(formatDate(m.createdAt))}</td>
        <td>${escapeHtml(MOVEMENT_LABELS[m.type] || m.type)}</td>
        <td>${escapeHtml(m.itemName)}</td>
        <td>${escapeHtml(movementCategory(m) || '-')}</td>
        ${selectedUnitId === 'all' ? `<td>${escapeHtml(unitName(m.unitId))}</td>` : ''}
        <td>${escapeHtml(`${m.delta > 0 ? '+' : ''}${formatNumber(m.delta)} ${m.measure || ''}`)}</td>
        <td>${escapeHtml(`${formatNumber(m.afterQty)} ${m.measure || ''}`)}</td>
        <td>${escapeHtml(m.createdByName || '-')}</td>
        <td>${escapeHtml(m.note || '-')}</td>
      </tr>
    `).join('')

    const printWindow = window.open('', '_blank', 'width=1100,height=760')
    if (!printWindow) return

    printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de estoque</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#1d2923;margin:28px;font-size:12px}
  h1{font-size:22px;margin:0 0 4px} .subtitle{color:#65736b;margin-bottom:18px}
  .filters{display:flex;flex-wrap:wrap;gap:7px 18px;margin-bottom:18px;padding:11px 13px;background:#f3f6f4;border:1px solid #dce4df;border-radius:8px}
  .filters span{font-weight:600} table{width:100%;border-collapse:collapse} th,td{border:1px solid #d9e0dc;padding:7px;text-align:left;vertical-align:top}
  th{background:#eef3f0;font-size:10px;text-transform:uppercase} .footer{margin-top:16px;color:#7a857f;font-size:10px}
  @page{size:landscape;margin:12mm}
</style>
</head>
<body>
  <h1>Relatório de movimentações do estoque</h1>
  <div class="subtitle">Assistência Social</div>
  <div class="filters">${filterLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div>
  <table>
    <thead><tr><th>Data</th><th>Tipo</th><th>Item</th><th>Categoria</th>${selectedUnitId === 'all' ? '<th>Unidade</th>' : ''}<th>Alteração</th><th>Saldo</th><th>Registrado por</th><th>Observação</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Relatório gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}.</div>
  <script>window.onload=()=>{window.print();}</script>
</body>
</html>`)
    printWindow.document.close()
  }

  return (
    <section>
      <div className="page-title-row">
        <div><h1>Histórico e relatórios</h1><p>Filtre as movimentações e imprima somente o que precisa.</p></div>
        <div className="report-actions">
          <button className="btn secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={17} /> CSV</button>
          <button className="btn primary" onClick={printReport} disabled={!filtered.length}><Printer size={17} /> Imprimir relatório</button>
        </div>
      </div>

      <div className="report-filters panel">
        <label className="field report-search"><span>Buscar</span><span className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, usuário ou observação..." /></span></label>
        <label className="field"><span>Movimentação</span><select value={type} onChange={(e) => setType(e.target.value)}><option value="all">Todas</option><option value="entrada">Somente entradas</option><option value="saida">Somente saídas</option><option value="ajuste">Somente ajustes</option></select></label>
        <label className="field"><span>Categoria</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Todas as categorias</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>De</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="field"><span>Até</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        {hasFilters && <button className="btn ghost clear-filters" onClick={clearFilters}><X size={16} /> Limpar filtros</button>}
      </div>

      <div className="report-count">{filtered.length} movimentação{filtered.length === 1 ? '' : 'ões'} encontrada{filtered.length === 1 ? '' : 's'}.</div>

      <div className="panel table-panel">
        {loading ? <div className="empty-inline">Carregando...</div> : filtered.length === 0 ? <div className="empty-state">Nenhuma movimentação encontrada.</div> : (
          <div className="responsive-table">
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Item</th><th>Categoria</th>{selectedUnitId === 'all' && <th>Unidade</th>}<th>Alteração</th><th>Saldo</th><th>Registrado por</th><th>Observação</th></tr></thead>
              <tbody>{filtered.map((m) => <tr key={m.id}>
                <td>{formatDate(m.createdAt)}</td>
                <td><span className={`badge ${m.type}`}>{MOVEMENT_LABELS[m.type]}</span></td>
                <td><strong>{m.itemName}</strong></td>
                <td>{movementCategory(m) || '-'}</td>
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
