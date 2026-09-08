import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitContext'
import { listItems } from '../services/itemsService'
import { registerMovement } from '../services/movementsService'
import { formatNumber } from '../utils/helpers'

export default function Move() {
  const { profile, isAdmin } = useAuth()
  const { units, selectedUnitId, setSelectedUnitId } = useUnits()
  const [unitId, setUnitId] = useState('')
  const [items, setItems] = useState([])
  const [itemId, setItemId] = useState('')
  const [type, setType] = useState('entrada')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (selectedUnitId && selectedUnitId !== 'all') setUnitId(selectedUnitId)
    else if (!unitId && units.length) setUnitId(units[0].id)
  }, [selectedUnitId, units])

  useEffect(() => {
    async function load() {
      if (!unitId) { setItems([]); return }
      try {
        const data = (await listItems(unitId)).filter((i) => i.active !== false)
        setItems(data)
        if (!data.some((i) => i.id === itemId)) setItemId(data[0]?.id || '')
      } catch (err) {
        console.error(err)
        setMessage({ type: 'error', text: 'Não foi possível carregar os itens.' })
      }
    }
    load()
  }, [unitId])

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId])

  async function submit(e) {
    e.preventDefault()
    if (!unitId || !itemId) return
    setSaving(true)
    setMessage(null)
    try {
      await registerMovement({
        unitId,
        itemId,
        type,
        quantity,
        note,
        user: { uid: profile.id, name: profile.name },
      })
      setMessage({ type: 'success', text: 'Movimentação registrada com sucesso.' })
      setQuantity('')
      setNote('')
      const data = (await listItems(unitId)).filter((i) => i.active !== false)
      setItems(data)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: err?.message || 'Não foi possível registrar a movimentação.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="narrow-page">
      <div className="page-title-row"><div><h1>Movimentar</h1><p>Escolha o item, a operação e a quantidade. Só isso.</p></div></div>

      <div className="panel movement-card">
        <form onSubmit={submit} className="form-stack">
          {isAdmin && (
            <label className="field"><span>Unidade</span><select value={unitId} onChange={(e) => { setUnitId(e.target.value); setSelectedUnitId(e.target.value) }}>{units.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label>
          )}

          <label className="field"><span>Item</span><select value={itemId} onChange={(e) => setItemId(e.target.value)} required>{items.length === 0 && <option value="">Nenhum item cadastrado</option>}{items.map((i) => <option value={i.id} key={i.id}>{i.name}</option>)}</select></label>

          {item && <div className="current-stock"><span>Estoque atual</span><strong>{formatNumber(item.quantity)} {item.measure}</strong></div>}

          <div className="movement-types">
            <button type="button" className={`movement-type ${type === 'entrada' ? 'selected entrada' : ''}`} onClick={() => setType('entrada')}><ArrowDownToLine size={20} /><span>Entrada</span></button>
            <button type="button" className={`movement-type ${type === 'saida' ? 'selected saida' : ''}`} onClick={() => setType('saida')}><ArrowUpFromLine size={20} /><span>Saída</span></button>
            <button type="button" className={`movement-type ${type === 'ajuste' ? 'selected ajuste' : ''}`} onClick={() => setType('ajuste')}><SlidersHorizontal size={20} /><span>Ajuste</span></button>
          </div>

          <label className="field"><span>{type === 'ajuste' ? 'Novo saldo' : 'Quantidade'} *</span><input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={type === 'ajuste' ? 'Quantidade correta no estoque' : 'Ex.: 10'} required /></label>
          <label className="field"><span>Observação</span><textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Compra mensal, entrega, correção de contagem..." /></label>

          {message && <div className={`alert ${message.type}`}>{message.text}</div>}
          <button className="btn primary full big" disabled={saving || !itemId}>{saving ? 'Registrando...' : 'Confirmar movimentação'}</button>
        </form>
      </div>
    </section>
  )
}
