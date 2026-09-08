import { useEffect, useState } from 'react'
import { Building2, Edit3, Plus } from 'lucide-react'
import { createUnit, updateUnit } from '../services/unitsService'
import { useUnits } from '../contexts/UnitContext'
import Modal from '../components/Modal'

export default function AdminUnits() {
  const { units, refreshUnits } = useUnits()
  const [modal, setModal] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { refreshUnits() }, [])

  function openNew() { setName(''); setError(''); setModal({ type: 'new' }) }
  function openEdit(unit) { setName(unit.name); setError(''); setModal({ type: 'edit', unit }) }

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      if (modal.type === 'new') await createUnit(name)
      else await updateUnit(modal.unit.id, { name: name.trim() })
      await refreshUnits()
      setModal(null)
    } catch (err) {
      console.error(err)
      setError('Não foi possível salvar a unidade.')
    } finally { setSaving(false) }
  }

  async function toggle(unit) {
    try {
      await updateUnit(unit.id, { active: unit.active === false })
      await refreshUnits()
    } catch (err) { console.error(err) }
  }

  return (
    <section>
      <div className="page-title-row"><div><h1>Unidades</h1><p>Separe Abrigo, CRAS, CREAS e outros setores.</p></div><button className="btn primary" onClick={openNew}><Plus size={17} /> Nova unidade</button></div>
      <div className="cards-list">
        {units.length === 0 ? <div className="empty-state panel">Crie sua primeira unidade, por exemplo “Unidade de Acolhimento”.</div> : units.map((unit) => (
          <article className="unit-card" key={unit.id}>
            <div className="unit-icon"><Building2 size={21} /></div>
            <div className="unit-info"><strong>{unit.name}</strong><span className={`status-dot ${unit.active === false ? 'off' : ''}`}>{unit.active === false ? 'Inativa' : 'Ativa'}</span></div>
            <div className="unit-actions"><button className="icon-button" onClick={() => openEdit(unit)}><Edit3 size={17} /></button><button className={`mini-toggle ${unit.active === false ? '' : 'on'}`} onClick={() => toggle(unit)}>{unit.active === false ? 'Ativar' : 'Desativar'}</button></div>
          </article>
        ))}
      </div>
      {modal && <Modal title={modal.type === 'new' ? 'Nova unidade' : 'Editar unidade'} onClose={() => setModal(null)} footer={<><button className="btn ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn primary" form="unit-form" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></>}>
        <form id="unit-form" onSubmit={save} className="form-stack"><label className="field"><span>Nome da unidade *</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: CRAS" /></label>{error && <div className="alert error">{error}</div>}<button hidden type="submit" /></form>
      </Modal>}
    </section>
  )
}
