import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { createResponsible, updateResponsible } from '../../services/responsiblesService'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const EMPTY = { name: '', sector: '', role: '', phone: '', email: '', notes: '', active: true }

export default function ResponsavelForm({ open, onClose, responsible }) {
  const { profile, firebaseUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(responsible || EMPTY)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    try {
      if (responsible) {
        await updateResponsible(responsible.id, form, user)
        toast.success('Responsável atualizado.')
      } else {
        await createResponsible(form, user)
        toast.success('Responsável cadastrado.')
      }
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível salvar o responsável.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={responsible ? 'Editar responsável' : 'Novo responsável'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="responsavel-form" loading={saving}>Salvar</Button>
        </>
      }
    >
      <form id="responsavel-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome" required>
          <Input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Setor">
            <Input value={form.sector} onChange={(e) => set('sector', e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={form.role} onChange={(e) => set('role', e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
        </div>
        <Field label="Status">
          <Select value={form.active ? 'true' : 'false'} onChange={(e) => set('active', e.target.value === 'true')}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Select>
        </Field>
        <Field label="Observação">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
