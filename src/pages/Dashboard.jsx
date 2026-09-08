import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Boxes, History, PackageCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitContext'
import { listItems } from '../services/itemsService'
import { listMovements } from '../services/movementsService'
import { formatDate, formatNumber, MOVEMENT_LABELS } from '../utils/helpers'

export default function Dashboard() {
  const { profile } = useAuth()
  const { units, selectedUnitId } = useUnits()
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const unitId = selectedUnitId && selectedUnitId !== 'all' ? selectedUnitId : null
        const [i, m] = await Promise.all([listItems(unitId), listMovements(unitId)])
        if (alive) {
          setItems(i.filter((x) => x.active !== false))
          setMovements(m)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (alive) setLoading(false)
      }
    }
    if (selectedUnitId) load()
    else setLoading(false)
    return () => { alive = false }
  }, [selectedUnitId])

  const low = useMemo(() => items.filter((i) => Number(i.minimum || 0) > 0 && Number(i.quantity || 0) <= Number(i.minimum || 0)), [items])
  const todayCount = useMemo(() => {
    const now = new Date()
    return movements.filter((m) => {
      const d = m.createdAt?.toDate?.()
      return d && d.toDateString() === now.toDateString()
    }).length
  }, [movements])
  const unitName = (id) => units.find((u) => u.id === id)?.name || '-'

  return (
    <section>
      <div className="page-title-row">
        <div><h1>Olá, {profile?.name?.split(' ')[0] || 'usuário'} 👋</h1><p>Visão rápida do estoque selecionado.</p></div>
      </div>

      {!selectedUnitId && <div className="empty-state">Nenhuma unidade foi criada ou liberada para este usuário.</div>}

      <div className="stats-grid">
        <article className="stat-card"><span className="stat-icon"><Boxes size={20} /></span><div><small>Itens cadastrados</small><strong>{loading ? '...' : items.length}</strong></div></article>
        <article className="stat-card"><span className="stat-icon warning"><AlertTriangle size={20} /></span><div><small>Estoque baixo</small><strong>{loading ? '...' : low.length}</strong></div></article>
        <article className="stat-card"><span className="stat-icon"><History size={20} /></span><div><small>Movimentações hoje</small><strong>{loading ? '...' : todayCount}</strong></div></article>
        <article className="stat-card"><span className="stat-icon success"><PackageCheck size={20} /></span><div><small>Unidade</small><strong className="small-value">{selectedUnitId === 'all' ? 'Todas' : unitName(selectedUnitId)}</strong></div></article>
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-head"><div><h2>Estoque baixo</h2><p>Itens no mínimo ou abaixo dele.</p></div></div>
          {low.length === 0 ? <div className="empty-inline">Nenhum alerta no momento.</div> : (
            <div className="simple-list">
              {low.slice(0, 8).map((item) => (
                <div className="simple-list-row" key={item.id}>
                  <div><strong>{item.name}</strong><small>{selectedUnitId === 'all' ? unitName(item.unitId) : item.category || 'Sem categoria'}</small></div>
                  <span className="qty danger">{formatNumber(item.quantity)} {item.measure}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-head"><div><h2>Últimas movimentações</h2><p>Entradas, saídas e ajustes recentes.</p></div></div>
          {movements.length === 0 ? <div className="empty-inline">Ainda não há movimentações.</div> : (
            <div className="simple-list">
              {movements.slice(0, 8).map((m) => (
                <div className="simple-list-row" key={m.id}>
                  <div><strong>{m.itemName}</strong><small>{MOVEMENT_LABELS[m.type]} · {formatDate(m.createdAt)}</small></div>
                  <span className={`movement-pill ${m.type}`}>{m.delta > 0 ? '+' : ''}{formatNumber(m.delta)} {m.measure}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
