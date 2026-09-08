import { useEffect, useMemo, useState } from 'react'
import { Edit3, Plus, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitContext'
import { createItem, listItems, updateItem } from '../services/itemsService'
import { formatNumber } from '../utils/helpers'
import Modal from '../components/Modal'

const emptyForm = { name: '', category: '', measure: 'un', minimum: 0, note: '' }

export default function Stock() {
  const { profile } = useAuth()
  const { units, selectedUnitId } = useUnits()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    if (!selectedUnitId) return
    setLoading(true)
    try {
      const unitId = selectedUnitId === 'all' ? null : selectedUnitId
      setItems(await listItems(unitId))
    } catch (err) {
      console.error(err)
      setMessage('Não foi possível carregar o estoque.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [selectedUnitId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (item.active === false) return false
      if (!q) return true
      return `${item.name} ${item.category}`.toLowerCase().includes(q)
    })
  }, [items, search])

  const unitName = (id) => units.find((u) => u.id === id)?.name || '-'

  function openNew() {
    if (!selectedUnitId || selectedUnitId === 'all') {
      setMessage('Selecione uma unidade específica para cadastrar um item.')
      return
    }
    setForm(emptyForm)
    setModal({ type: 'new' })
  }

  function openEdit(item) {
    setForm({
      name: item.name || '',
      category: item.category || '',
      measure: item.measure || 'un',
      minimum: item.minimum || 0,
      note: item.note || '',
    })
    setModal({ type: 'edit', item })
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      if (modal.type === 'new') {
        await createItem({ unitId: selectedUnitId, ...form, user: { uid: profile.id, name: profile.name } })
      } else {
        await updateItem(modal.item.id, form, { uid: profile.id, name: profile.name })
      }
      setModal(null)
      await load()
    } catch (err) {
      console.error(err)
      setMessage(err?.message || 'Não foi possível salvar o item.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="page-title-row">
        <div><h1>Estoque</h1><p>Lista simples dos itens e das quantidades atuais.</p></div>
        <button className="btn primary" onClick={openNew}><Plus size={17} /> Novo item</button>
      </div>

      {message && <div className="alert error">{message}</div>}

      <div className="toolbar">
        <label className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item ou categoria..." /></label>
      </div>

      <div className="panel table-panel">
        {loading ? <div className="empty-inline">Carregando...</div> : filtered.length === 0 ? <div className="empty-state">Nenhum item encontrado.</div> : (
          <div className="responsive-table">
            <table>
              <thead><tr><th>Item</th>{selectedUnitId === 'all' && <th>Unidade</th>}<th>Categoria</th><th>Estoque</th><th>Mínimo</th><th></th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const low = Number(item.minimum || 0) > 0 && Number(item.quantity || 0) <= Number(item.minimum || 0)
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong><small className="cell-note">{item.note}</small></td>
                      {selectedUnitId === 'all' && <td>{unitName(item.unitId)}</td>}
                      <td>{item.category || '-'}</td>
                      <td><span className={`stock-value ${low ? 'low' : ''}`}>{formatNumber(item.quantity)} {item.measure}</span></td>
                      <td>{formatNumber(item.minimum)} {item.measure}</td>
                      <td className="actions-cell"><button className="icon-button" onClick={() => openEdit(item)} title="Editar"><Edit3 size={17} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.type === 'new' ? 'Novo item' : 'Editar item'} onClose={() => setModal(null)} footer={
          <><button className="btn ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn primary" form="item-form" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></>
        }>
          <form id="item-form" className="form-grid" onSubmit={save}>
            <label className="field span-2"><span>Nome *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Arroz 5 kg" /></label>
            <label className="field"><span>Categoria</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Alimentos" /></label>
            <label className="field"><span>Unidade de medida</span><select value={form.measure} onChange={(e) => setForm({ ...form, measure: e.target.value })}><option value="un">un</option><option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option><option value="pct">pacote</option><option value="cx">caixa</option><option value="fardo">fardo</option></select></label>
            <label className="field"><span>Estoque mínimo</span><input type="number" min="0" step="0.01" value={form.minimum} onChange={(e) => setForm({ ...form, minimum: e.target.value })} /></label>
            <label className="field span-2"><span>Observação</span><textarea rows="3" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Opcional" /></label>
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </section>
  )
}
