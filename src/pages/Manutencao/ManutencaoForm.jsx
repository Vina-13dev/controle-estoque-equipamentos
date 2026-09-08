import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { subscribeEquipments } from '../../services/equipmentsService'
import { openMaintenance } from '../../services/maintenanceService'
import { EQUIPMENT_STATUS } from '../../utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function ManutencaoForm({ open, onClose }) {
  const { profile, firebaseUser } = useAuth()
  const toast = useToast()
  const [equipments, setEquipments] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    equipmentId: '',
    problem: '',
    technician: '',
    cost: '',
    expectedReturnDate: '',
    notes: '',
  })

  useEffect(() => subscribeEquipments(setEquipments), [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    try {
      await openMaintenance(form, user)
      toast.success('Manutenção aberta. Equipamento atualizado para "Em manutenção".')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Não foi possível abrir a manutenção.')
    } finally {
      setSaving(false)
    }
  }

  const availableEquipments = equipments.filter((e) => e.status !== EQUIPMENT_STATUS.EM_MANUTENCAO)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abrir manutenção"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="manutencao-form" loading={saving}>Abrir manutenção</Button>
        </>
      }
    >
      <form id="manutencao-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Equipamento" required>
          <Select required value={form.equipmentId} onChange={(e) => set('equipmentId', e.target.value)}>
            <option value="">Selecione...</option>
            {availableEquipments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
        <Field label="Problema" required>
          <Textarea required value={form.problem} onChange={(e) => set('problem', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Técnico/empresa">
            <Input value={form.technician} onChange={(e) => set('technician', e.target.value)} />
          </Field>
          <Field label="Custo estimado (R$)">
            <Input type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
          </Field>
        </div>
        <Field label="Previsão de retorno">
          <Input type="date" value={form.expectedReturnDate} onChange={(e) => set('expectedReturnDate', e.target.value)} />
        </Field>
        <Field label="Observações">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
