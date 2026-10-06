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

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

export default function History() {
  const { units, selectedUnitId } = useUnits()
  const [movements, setMovements] = useState([])
  const [items, setItems] = useState([])
  const [reportKind, setReportKind] = useState('stock')
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

  const unitName = (id) => units.find((u) => u.id === id)?.name || '-'

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  )

  function movementCategory(movement) {
    return movement.itemCategory || itemById.get(movement.itemId)?.category || ''
  }

  const categories = useMemo(() => {
    const values = new Set()

    items.forEach((item) => {
      if (item.active === false) return
      const value = String(item.category || '').trim()
      if (value) values.add(value)
    })

    movements.forEach((movement) => {
      const value = String(
        movement.itemCategory || itemById.get(movement.itemId)?.category || '',
      ).trim()
      if (value) values.add(value)
    })

    return [...values].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [items, movements, itemById])

  const filteredMovements = useMemo(() => {
    const q = normalize(search)
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null

    return movements.filter((movement) => {
      if (type !== 'all' && normalize(movement.type) !== normalize(type)) {
        return false
      }

      const itemCategory = movementCategory(movement)
      if (category !== 'all' && normalize(itemCategory) !== normalize(category)) {
        return false
      }

      const date = movementDate(movement.createdAt)
      if (start && (!date || date < start)) return false
      if (end && (!date || date > end)) return false

      if (!q) return true

      return normalize(
        `${movement.itemName} ${itemCategory} ${movement.createdByName} ${movement.note}`,
      ).includes(q)
    })
  }, [movements, type, category, startDate, endDate, search, itemById])

  const filteredStock = useMemo(() => {
    const q = normalize(search)

    return items.filter((item) => {
      if (item.active === false) return false

      if (category !== 'all' && normalize(item.category) !== normalize(category)) {
        return false
      }

      if (!q) return true

      return normalize(`${item.name} ${item.category} ${item.note}`).includes(q)
    })
  }, [items, category, search])

  const visibleRows = reportKind === 'stock' ? filteredStock : filteredMovements

  const hasFilters =
    category !== 'all' ||
    search ||
    (reportKind === 'movements' &&
      (type !== 'all' || startDate || endDate))

  function clearFilters() {
    setType('all')
    setCategory('all')
    setStartDate('')
    setEndDate('')
    setSearch('')
  }

  function exportCsv() {
    let rows
    let filename

    if (reportKind === 'stock') {
      rows = [
        ['Item', 'Categoria', 'Unidade', 'Quantidade atual', 'Medida', 'Estoque mínimo', 'Situação', 'Observação'],
        ...filteredStock.map((item) => {
          const low =
            Number(item.minimum || 0) > 0 &&
            Number(item.quantity || 0) <= Number(item.minimum || 0)

          return [
            item.name,
            item.category || '-',
            unitName(item.unitId),
            item.quantity,
            item.measure || '',
            item.minimum || 0,
            low ? 'Estoque baixo' : 'Normal',
            item.note || '',
          ]
        }),
      ]
      filename = 'estoque-atual'
    } else {
      rows = [
        ['Data', 'Tipo', 'Item', 'Categoria', 'Unidade', 'Antes', 'Depois', 'Diferença', 'Registrado por', 'Observação'],
        ...filteredMovements.map((movement) => [
          formatDate(movement.createdAt),
          MOVEMENT_LABELS[movement.type] || movement.type,
          movement.itemName,
          movementCategory(movement) || '-',
          unitName(movement.unitId),
          movement.beforeQty,
          movement.afterQty,
          movement.delta,
          movement.createdByName,
          movement.note || '',
        ]),
      ]
      filename = 'movimentacoes'
    }

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
          .join(';'),
      )
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function printStockReport() {
    const rowsToPrint = [...filteredStock]
    if (!rowsToPrint.length) return

    const selectedUnitName =
      selectedUnitId === 'all' ? 'Todas as unidades' : unitName(selectedUnitId)

    const filterLines = [
      `Unidade: ${selectedUnitName}`,
      `Categoria: ${category === 'all' ? 'Todas' : category}`,
      `Itens: ${rowsToPrint.length}`,
    ]

    const rows = rowsToPrint
      .map((item) => {
        const low =
          Number(item.minimum || 0) > 0 &&
          Number(item.quantity || 0) <= Number(item.minimum || 0)

        return `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category || '-')}</td>
            ${selectedUnitId === 'all' ? `<td>${escapeHtml(unitName(item.unitId))}</td>` : ''}
            <td><strong>${escapeHtml(`${formatNumber(item.quantity)} ${item.measure || ''}`)}</strong></td>
            <td>${escapeHtml(`${formatNumber(item.minimum || 0)} ${item.measure || ''}`)}</td>
            <td>${escapeHtml(low ? 'Estoque baixo' : 'Normal')}</td>
            <td>${escapeHtml(item.note || '-')}</td>
          </tr>
        `
      })
      .join('')

    openPrintWindow({
      title: 'Estoque atual',
      subtitle: 'Relatório da posição atual do estoque',
      filterLines,
      header: `<tr><th>Item</th><th>Categoria</th>${selectedUnitId === 'all' ? '<th>Unidade</th>' : ''}<th>Quantidade atual</th><th>Mínimo</th><th>Situação</th><th>Observação</th></tr>`,
      rows,
      landscape: false,
    })
  }

  function printMovementReport() {
    // Faz uma cópia EXATA da lista já filtrada exibida na tela.
    // Assim, ao selecionar "Somente entradas", nenhuma saída/ajuste entra na impressão.
    const rowsToPrint = [...filteredMovements]
    if (!rowsToPrint.length) return

    const selectedUnitName =
      selectedUnitId === 'all' ? 'Todas as unidades' : unitName(selectedUnitId)

    const filterLines = [
      `Unidade: ${selectedUnitName}`,
      `Tipo: ${type === 'all' ? 'Todos' : MOVEMENT_LABELS[type] || type}`,
      `Categoria: ${category === 'all' ? 'Todas' : category}`,
      `Período: ${startDate || 'início'} até ${endDate || 'hoje'}`,
      `Registros: ${rowsToPrint.length}`,
    ]

    const rows = rowsToPrint
      .map(
        (movement) => `
          <tr>
            <td>${escapeHtml(formatDate(movement.createdAt))}</td>
            <td>${escapeHtml(MOVEMENT_LABELS[movement.type] || movement.type)}</td>
            <td>${escapeHtml(movement.itemName)}</td>
            <td>${escapeHtml(movementCategory(movement) || '-')}</td>
            ${selectedUnitId === 'all' ? `<td>${escapeHtml(unitName(movement.unitId))}</td>` : ''}
            <td>${escapeHtml(`${movement.delta > 0 ? '+' : ''}${formatNumber(movement.delta)} ${movement.measure || ''}`)}</td>
            <td>${escapeHtml(`${formatNumber(movement.afterQty)} ${movement.measure || ''}`)}</td>
            <td>${escapeHtml(movement.createdByName || '-')}</td>
            <td>${escapeHtml(movement.note || '-')}</td>
          </tr>
        `,
      )
      .join('')

    openPrintWindow({
      title: 'Relatório de movimentações',
      subtitle: 'Entradas, saídas e ajustes conforme os filtros selecionados',
      filterLines,
      header: `<tr><th>Data</th><th>Tipo</th><th>Item</th><th>Categoria</th>${selectedUnitId === 'all' ? '<th>Unidade</th>' : ''}<th>Alteração</th><th>Saldo</th><th>Registrado por</th><th>Observação</th></tr>`,
      rows,
      landscape: true,
    })
  }

  function openPrintWindow({ title, subtitle, filterLines, header, rows, landscape }) {
    const printWindow = window.open('', '_blank', 'width=1100,height=760')
    if (!printWindow) return

    printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#1d2923;margin:28px;font-size:12px}
  h1{font-size:22px;margin:0 0 4px}
  .subtitle{color:#65736b;margin-bottom:18px}
  .filters{display:flex;flex-wrap:wrap;gap:7px 18px;margin-bottom:18px;padding:11px 13px;background:#f3f6f4;border:1px solid #dce4df;border-radius:8px}
  .filters span{font-weight:600}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #d9e0dc;padding:7px;text-align:left;vertical-align:top}
  th{background:#eef3f0;font-size:10px;text-transform:uppercase}
  .footer{margin-top:16px;color:#7a857f;font-size:10px}
  @page{size:${landscape ? 'landscape' : 'portrait'};margin:12mm}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">${escapeHtml(subtitle)} • Assistência Social</div>
  <div class="filters">${filterLines
    .map((line) => `<span>${escapeHtml(line)}</span>`)
    .join('')}</div>
  <table>
    <thead>${header}</thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Relatório gerado em ${escapeHtml(
    new Date().toLocaleString('pt-BR'),
  )}.</div>
  <script>
    window.onload = () => {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`)

    printWindow.document.close()
  }

  function printReport() {
    if (reportKind === 'stock') {
      printStockReport()
    } else {
      printMovementReport()
    }
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Relatórios</h1>
          <p>Imprima o estoque atual ou as movimentações usando os filtros abaixo.</p>
        </div>

        <div className="report-actions">
          <button
            className="btn secondary"
            onClick={exportCsv}
            disabled={!visibleRows.length}
          >
            <Download size={17} /> CSV
          </button>

          <button
            className="btn primary"
            onClick={printReport}
            disabled={!visibleRows.length}
          >
            <Printer size={17} /> Imprimir relatório
          </button>
        </div>
      </div>

      <div className="report-filters panel">
        <label className="field">
          <span>Relatório</span>
          <select value={reportKind} onChange={(e) => setReportKind(e.target.value)}>
            <option value="stock">Estoque atual</option>
            <option value="movements">Movimentações</option>
          </select>
        </label>

        <label className="field report-search">
          <span>Buscar</span>
          <span className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                reportKind === 'stock'
                  ? 'Item, categoria ou observação...'
                  : 'Item, usuário ou observação...'
              }
            />
          </span>
        </label>

        {reportKind === 'movements' && (
          <label className="field">
            <span>Movimentação</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Todas</option>
              <option value="entrada">Somente entradas</option>
              <option value="saida">Somente saídas</option>
              <option value="ajuste">Somente ajustes</option>
            </select>
          </label>
        )}

        <label className="field">
          <span>Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        {reportKind === 'movements' && (
          <>
            <label className="field">
              <span>De</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </>
        )}

        {hasFilters && (
          <button className="btn ghost clear-filters" onClick={clearFilters}>
            <X size={16} /> Limpar filtros
          </button>
        )}
      </div>

      <div className="report-count">
        {reportKind === 'stock'
          ? `${filteredStock.length} item${filteredStock.length === 1 ? '' : 's'} no estoque atual.`
          : `${filteredMovements.length} movimentação${filteredMovements.length === 1 ? '' : 'ões'} encontrada${filteredMovements.length === 1 ? '' : 's'}.`}
      </div>

      <div className="panel table-panel">
        {loading ? (
          <div className="empty-inline">Carregando...</div>
        ) : visibleRows.length === 0 ? (
          <div className="empty-state">
            {reportKind === 'stock'
              ? 'Nenhum item encontrado no estoque.'
              : 'Nenhuma movimentação encontrada.'}
          </div>
        ) : reportKind === 'stock' ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  {selectedUnitId === 'all' && <th>Unidade</th>}
                  <th>Quantidade atual</th>
                  <th>Mínimo</th>
                  <th>Situação</th>
                  <th>Observação</th>
                </tr>
              </thead>

              <tbody>
                {filteredStock.map((item) => {
                  const low =
                    Number(item.minimum || 0) > 0 &&
                    Number(item.quantity || 0) <= Number(item.minimum || 0)

                  return (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.category || '-'}</td>
                      {selectedUnitId === 'all' && <td>{unitName(item.unitId)}</td>}
                      <td>{formatNumber(item.quantity)} {item.measure}</td>
                      <td>{formatNumber(item.minimum || 0)} {item.measure}</td>
                      <td>{low ? 'Estoque baixo' : 'Normal'}</td>
                      <td className="note-cell">{item.note || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Categoria</th>
                  {selectedUnitId === 'all' && <th>Unidade</th>}
                  <th>Alteração</th>
                  <th>Saldo</th>
                  <th>Registrado por</th>
                  <th>Observação</th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>
                      <span className={`badge ${movement.type}`}>
                        {MOVEMENT_LABELS[movement.type] || movement.type}
                      </span>
                    </td>
                    <td><strong>{movement.itemName}</strong></td>
                    <td>{movementCategory(movement) || '-'}</td>
                    {selectedUnitId === 'all' && <td>{unitName(movement.unitId)}</td>}
                    <td>
                      <span
                        className={`delta ${
                          movement.delta < 0
                            ? 'negative'
                            : movement.delta > 0
                              ? 'positive'
                              : ''
                        }`}
                      >
                        {movement.delta > 0 ? '+' : ''}
                        {formatNumber(movement.delta)} {movement.measure}
                      </span>
                    </td>
                    <td>{formatNumber(movement.afterQty)} {movement.measure}</td>
                    <td>{movement.createdByName || '-'}</td>
                    <td className="note-cell">{movement.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
