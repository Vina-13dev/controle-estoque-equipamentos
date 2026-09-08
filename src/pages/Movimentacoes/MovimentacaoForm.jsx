import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { subscribeEquipments } from '../../services/equipmentsService'
import { subscribeResponsibles } from '../../services/responsiblesService'
import { createMovement } from '../../services/movementsService'
import { MOVEMENT_TYPE_LABEL, MOVEMENT_TYPES } from '../../utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const TYPE_OPTIONS = [
  MOVEMENT_TYPES.ENTRADA,
  MOVEMENT_TYPES.SAIDA,
  MOVEMENT_TYPES.DEVOLUCAO,
  MOVEMENT_TYPES.BAIXA,
  MOVEMENT_TYPES.AJUSTE,
]

export default function MovimentacaoForm({ open, onClose, defaultType }) {
  const { profile, firebaseUser, isAdmin } = useAuth()
  const toast = useToast()
  const [equipments, setEquipments] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [step, setStep] = useState('form') // 'form' | 'confirm'
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    type: defaultType || MOVEMENT_TYPES.SAIDA,
    equipmentId: '',
    quantity: 1,
    responsibleId: '',
    sector: '',
    reason: '',
    notes: '',
  })

  useEffect(() => subscribeEquipments(setEquipments), [])
  useEffect(() => subscribeResponsibles(setResponsibles), [])

  const equipment = useMemo(() => equipments.find((e) => e.id === form.equipmentId), [equipments, form.equipmentId])
  const responsible = useMemo(() => responsibles.find((r) => r.id === form.responsibleId), [responsibles, form.responsibleId])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleReview(e) {
    e.preventDefault()
    setStep('confirm')
  }

  async function handleConfirm() {
    setSaving(true)
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    try {
      await createMovement(
        {
          type: form.type,
          equipmentId: form.equipmentId,
          quantity: form.quantity,
          responsibleId: form.responsibleId || null,
          responsibleName: responsible?.name || null,
          sector: form.sector,
          reason: form.reason,
          notes: form.notes,
        },
        user
      )
      toast.success('Movimentação registrada.')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Não foi possível registrar a movimentação.')
      setStep('form')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'form' ? 'Nova movimentação' : 'Confirmar movimentação'}
      footer={
        step === 'form' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="movimentacao-form">Revisar</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep('form')}>Voltar</Button>
            <Button onClick={handleConfirm} loading={saving}>Confirmar</Button>
          </>
        )
      }
    >
      {step === 'form' ? (
        <form id="movimentacao-form" onSubmit={handleReview} className="space-y-4">
          <Field label="Tipo" required>
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPE_OPTIONS.filter((t) => t !== MOVEMENT_TYPES.AJUSTE || isAdmin).map((t) => (
                <option key={t} value={t}>{MOVEMENT_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Equipamento" required>
            <Select required value={form.equipmentId} onChange={(e) => set('equipmentId', e.target.value)}>
              <option value="">Selecione...</option>
              {equipments.map((e) => (
                <option key={e.id} value={e.id}>{e.name} (estoque: {e.quantity})</option>
              ))}
            </Select>
          </Field>
          <Field label={form.type === MOVEMENT_TYPES.AJUSTE ? 'Ajuste (use negativo para reduzir)' : 'Quantidade'} required>
            <Input type="number" required value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          {form.type !== MOVEMENT_TYPES.AJUSTE && (
            <Field label="Responsável">
              <Select value={form.responsibleId} onChange={(e) => set('responsibleId', e.target.value)}>
                <option value="">Selecione...</option>
                {responsibles.filter((r) => r.active).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.sector ? ` - ${r.sector}` : ''}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Setor">
            <Input value={form.sector} onChange={(e) => set('sector', e.target.value)} />
          </Field>
          <Field label="Motivo">
            <Input value={form.reason} onChange={(e) => set('reason', e.target.value)} />
          </Field>
          <Field label="Observação">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-ink-faint">Confira os dados antes de confirmar. Após confirmada, a movimentação não poderá ser editada nem apagada.</p>
          <dl className="grid grid-cols-2 gap-y-2 rounded border border-ink/8 p-3">
            <dt className="text-ink-faint">Tipo</dt><dd className="text-ink">{MOVEMENT_TYPE_LABEL[form.type]}</dd>
            <dt className="text-ink-faint">Equipamento</dt><dd className="text-ink">{equipment?.name}</dd>
            <dt className="text-ink-faint">Quantidade</dt><dd className="text-ink">{form.quantity}</dd>
            <dt className="text-ink-faint">Responsável</dt><dd className="text-ink">{responsible?.name || '-'}</dd>
            <dt className="text-ink-faint">Setor</dt><dd className="text-ink">{form.sector || '-'}</dd>
            <dt className="text-ink-faint">Motivo</dt><dd className="text-ink">{form.reason || '-'}</dd>
          </dl>
        </div>
      )}
    </Modal>
  )
}
