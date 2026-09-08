import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { EQUIPMENT_STATUS, EQUIPMENT_STATUS_LABEL } from '../../utils/constants'
import { createEquipment, updateEquipment } from '../../services/equipmentsService'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const EMPTY = {
  code: '',
  name: '',
  description: '',
  assetTag: '',
  serialNumber: '',
  brand: '',
  model: '',
  quantity: 0,
  minStock: 0,
  location: '',
  sector: '',
  status: EQUIPMENT_STATUS.DISPONIVEL,
  notes: '',
}

export default function EquipamentoForm({ open, onClose, equipment }) {
  const { profile, firebaseUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(equipment || EMPTY)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    try {
      if (equipment) {
        await updateEquipment(equipment.id, form, user)
        toast.success('Equipamento atualizado.')
      } else {
        await createEquipment(form, user)
        toast.success('Equipamento cadastrado.')
      }
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível salvar o equipamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={equipment ? 'Editar equipamento' : 'Novo equipamento'}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="equipamento-form" loading={saving}>Salvar</Button>
        </>
      }
    >
      <form id="equipamento-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome" required>
          <Input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Código interno">
          <Input value={form.code} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <Field label="Patrimônio">
          <Input value={form.assetTag} onChange={(e) => set('assetTag', e.target.value)} />
        </Field>
        <Field label="Número de série">
          <Input value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
        </Field>
        <Field label="Marca">
          <Input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
        </Field>
        <Field label="Modelo">
          <Input value={form.model} onChange={(e) => set('model', e.target.value)} />
        </Field>
        <Field label="Quantidade" required hint={equipment ? 'Alterar aqui é uma correção manual, não gera movimentação.' : undefined}>
          <Input type="number" min="0" required value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
        </Field>
        <Field label="Estoque mínimo">
          <Input type="number" min="0" value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
        </Field>
        <Field label="Localização">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Setor">
          <Input value={form.sector} onChange={(e) => set('sector', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(EQUIPMENT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descrição">
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Observações">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}
