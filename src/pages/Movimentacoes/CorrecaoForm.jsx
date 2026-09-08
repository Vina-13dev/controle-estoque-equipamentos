import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { subscribeResponsibles } from '../../services/responsiblesService'
import { createCorrection } from '../../services/movementsService'
import { MOVEMENT_TYPE_LABEL } from '../../utils/constants'
import { formatSequence } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function CorrecaoForm({ open, onClose, movement }) {
  const { profile, firebaseUser } = useAuth()
  const toast = useToast()
  const [responsibles, setResponsibles] = useState([])
  const [responsibleId, setResponsibleId] = useState(movement?.responsibleId || '')
  const [quantity, setQuantity] = useState(movement?.quantity || 0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribeResponsibles(setResponsibles), [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error('Informe o motivo da correção.')
      return
    }
    setSaving(true)
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    const responsible = responsibles.find((r) => r.id === responsibleId)
    try {
      await createCorrection(
        {
          originalMovementId: movement.id,
          corrected: {
            quantity: Number(quantity),
            responsibleId: responsibleId || null,
            responsibleName: responsible?.name || null,
          },
          reason,
        },
        user
      )
      toast.success('Correção registrada.')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Não foi possível registrar a correção.')
    } finally {
      setSaving(false)
    }
  }

  if (!movement) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Corrigir movimentação ${formatSequence(movement.sequence)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="correcao-form" loading={saving}>Registrar correção</Button>
        </>
      }
    >
      <div className="mb-4 rounded border border-ink/8 bg-surface-alt p-3 text-sm">
        <p className="text-ink-faint">Movimentação original (permanece intacta):</p>
        <p className="text-ink">
          {MOVEMENT_TYPE_LABEL[movement.type]} · {movement.equipmentName} · qtd. {movement.quantity} ·{' '}
          {movement.responsibleName || 'sem responsável'}
        </p>
      </div>
      <form id="correcao-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Quantidade correta" required>
          <Input type="number" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Responsável correto">
          <Select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Nenhum</option>
            {responsibles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Motivo da correção" required>
          <Textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique o que estava errado e o que foi corrigido." />
        </Field>
      </form>
    </Modal>
  )
}
