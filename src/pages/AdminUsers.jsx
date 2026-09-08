import { useEffect, useState } from 'react'
import { CheckCircle2, Edit3, Plus, UserCog, UserRoundX } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUnits } from '../contexts/UnitContext'
import { createLocalUser } from '../services/authService'
import { listUsers, updateUserProfile } from '../services/usersService'
import Modal from '../components/Modal'

const newUserDefault = {
  name: '',
  username: '',
  password: '',
  role: 'operator',
  allowedUnitIds: [],
}

export default function AdminUsers() {
  const { profile: currentProfile } = useAuth()
  const { units } = useUnits()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(newUserDefault)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setUsers(await listUsers()) }
    catch (err) { console.error(err); setError('Não foi possível carregar os usuários.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm(newUserDefault)
    setError('')
    setModal({ type: 'new' })
  }

  function openEdit(user) {
    setForm({
      name: user.name || '',
      username: user.username || '',
      password: '',
      role: user.role || 'operator',
      active: user.active === true,
      allowedUnitIds: user.role === 'admin' ? ['*'] : (user.allowedUnitIds || []),
    })
    setError('')
    setModal({ type: 'edit', user })
  }

  function toggleUnit(id) {
    setForm((prev) => {
      const current = prev.allowedUnitIds || []
      return {
        ...prev,
        allowedUnitIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      }
    })
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (modal.type === 'new') {
        if (form.role !== 'admin' && form.allowedUnitIds.length === 0) throw new Error('Selecione pelo menos uma unidade.')
        await createLocalUser(form)
      } else {
        if (modal.user.id === currentProfile.id && form.active === false) throw new Error('Você não pode desativar seu próprio usuário.')
        if (form.role !== 'admin' && form.active && form.allowedUnitIds.length === 0) throw new Error('Selecione pelo menos uma unidade.')
        await updateUserProfile(modal.user.id, {
          name: form.name.trim(),
          role: form.role,
          active: form.active,
          allowedUnitIds: form.role === 'admin' ? ['*'] : form.allowedUnitIds,
        })
      }
      setModal(null)
      await load()
    } catch (err) {
      console.error(err)
      if (err?.code === 'auth/email-already-in-use') setError('Esse nome de usuário já existe.')
      else setError(err?.message || 'Não foi possível salvar o usuário.')
    } finally { setSaving(false) }
  }

  const allowedNames = (user) => {
    if (user.role === 'admin') return 'Todas as unidades'
    const ids = user.allowedUnitIds || []
    if (!ids.length) return 'Nenhuma unidade'
    return ids.map((id) => units.find((u) => u.id === id)?.name).filter(Boolean).join(', ') || 'Nenhuma unidade'
  }

  return (
    <section>
      <div className="page-title-row">
        <div><h1>Usuários</h1><p>Crie acessos e escolha exatamente quais unidades cada pessoa pode ver.</p></div>
        <button className="btn primary" onClick={openNew}><Plus size={17} /> Novo usuário</button>
      </div>

      {error && !modal && <div className="alert error">{error}</div>}

      <div className="panel table-panel">
        {loading ? <div className="empty-inline">Carregando...</div> : users.length === 0 ? <div className="empty-state">Nenhum usuário cadastrado.</div> : (
          <div className="responsive-table">
            <table>
              <thead><tr><th>Usuário</th><th>Acesso</th><th>Unidades</th><th>Status</th><th></th></tr></thead>
              <tbody>{users.map((user) => (
                <tr key={user.id}>
                  <td><div className="user-cell"><div className="avatar small">{(user.name || 'U')[0].toUpperCase()}</div><div><strong>{user.name || 'Sem nome'}</strong><small>{user.username ? `@${user.username}` : user.email || 'Conta Google'}</small></div></div></td>
                  <td><span className={`badge ${user.role === 'admin' ? 'admin' : 'neutral'}`}>{user.role === 'admin' ? 'Administrador' : 'Operador'}</span></td>
                  <td className="units-cell">{allowedNames(user)}</td>
                  <td>{user.active ? <span className="status active"><CheckCircle2 size={15} /> Ativo</span> : <span className="status pending"><UserRoundX size={15} /> Aguardando/Bloqueado</span>}</td>
                  <td className="actions-cell"><button className="icon-button" onClick={() => openEdit(user)}><Edit3 size={17} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="info-box"><UserCog size={20} /><div><strong>Contas Google novas</strong><p>Quem entrar com Google pela primeira vez aparece aqui como “Aguardando/Bloqueado”. Você abre o usuário, escolhe a unidade e ativa.</p></div></div>

      {modal && (
        <Modal title={modal.type === 'new' ? 'Criar usuário' : `Editar ${modal.user.name || 'usuário'}`} onClose={() => setModal(null)} footer={
          <><button className="btn ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn primary" form="user-form" disabled={saving}>{saving ? 'Salvando...' : modal.type === 'new' ? 'Criar usuário' : 'Salvar permissões'}</button></>
        }>
          <form id="user-form" onSubmit={save} className="form-grid">
            <label className="field span-2"><span>Nome *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Maria Silva" /></label>

            {modal.type === 'new' && <>
              <label className="field"><span>Usuário *</span><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Ex.: maria" /></label>
              <label className="field"><span>Senha inicial *</span><input required minLength="6" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></label>
            </>}

            <label className="field"><span>Tipo de acesso</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, allowedUnitIds: e.target.value === 'admin' ? ['*'] : [] })}><option value="operator">Operador</option><option value="admin">Administrador</option></select></label>

            {modal.type === 'edit' && <label className="field checkbox-field"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>Usuário ativo</span></label>}

            {form.role !== 'admin' && <div className="field span-2"><span>Unidades permitidas *</span><div className="check-grid">{units.filter((u) => u.active !== false).map((unit) => <label className={`unit-check ${form.allowedUnitIds.includes(unit.id) ? 'checked' : ''}`} key={unit.id}><input type="checkbox" checked={form.allowedUnitIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} /><span>{unit.name}</span></label>)}</div>{units.length === 0 && <small className="muted">Crie as unidades antes de liberar um operador.</small>}</div>}

            {form.role === 'admin' && <div className="alert info span-2">Administrador tem acesso a todas as unidades e à área de usuários.</div>}
            {error && <div className="alert error span-2">{error}</div>}
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </section>
  )
}
