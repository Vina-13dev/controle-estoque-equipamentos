import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { subscribeEquipments } from '../../services/equipmentsService'
import { subscribeResponsibles } from '../../services/responsiblesService'
import { createMovement } from '../../services/movementsService'
import { openMaintenance } from '../../services/maintenanceService'
import Button from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { MOVEMENT_TYPE_LABEL, MOVEMENT_TYPES } from '../../utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'

const STEPS = ['equipamento', 'tipo', 'responsavel', 'quantidade', 'observacao', 'revisao']

const TYPE_OPTIONS = [MOVEMENT_TYPES.ENTRADA, MOVEMENT_TYPES.SAIDA, MOVEMENT_TYPES.DEVOLUCAO, 'manutencao']

export default function MovimentacaoRapida() {
  const { profile, firebaseUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [equipments, setEquipments] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState({
    equipmentId: '',
    type: '',
    responsibleId: '',
    quantity: 1,
    notes: '',
  })

  useEffect(() => subscribeEquipments(setEquipments), [])
  useEffect(() => subscribeResponsibles(setResponsibles), [])

  const step = STEPS[stepIndex]
  const equipment = useMemo(() => equipments.find((e) => e.id === data.equipmentId), [equipments, data.equipmentId])
  const responsible = useMemo(() => responsibles.find((r) => r.id === data.responsibleId), [responsibles, data.responsibleId])

  // Manutenção não usa quantidade - pula essa etapa automaticamente
  useEffect(() => {
    if (step === 'quantidade' && data.type === 'manutencao') {
      setStepIndex((i) => i + 1)
    }
  }, [step, data.type])

  function set(field, value) {
    setData((d) => ({ ...d, [field]: value }))
  }

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  function back() {
    if (stepIndex === 0) navigate('/')
    else setStepIndex((i) => i - 1)
  }

  async function confirm() {
    setSaving(true)
    const user = { uid: firebaseUser.uid, name: profile.name, email: profile.email }
    try {
      if (data.type === 'manutencao') {
        await openMaintenance(
          { equipmentId: data.equipmentId, problem: data.notes, responsibleId: data.responsibleId, responsibleName: responsible?.name },
          user
        )
      } else {
        await createMovement(
          {
            type: data.type,
            equipmentId: data.equipmentId,
            quantity: data.quantity,
            responsibleId: data.responsibleId || null,
            responsibleName: responsible?.name || null,
            notes: data.notes,
          },
          user
        )
      }
      toast.success('Registrado com sucesso!')
      navigate('/')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Não foi possível registrar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <button onClick={back} className="mb-4 flex items-center gap-1 text-sm text-ink-soft">
        <ChevronLeft size={16} /> Voltar
      </button>

      <div className="mb-6 flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-steel-500' : 'bg-surface-base'}`} />
        ))}
      </div>

      {step === 'equipamento' && (
        <StepList
          title="Selecione o equipamento"
          items={equipments.map((e) => ({ id: e.id, label: e.name, sub: `Estoque: ${e.quantity}` }))}
          onSelect={(id) => { set('equipmentId', id); next() }}
        />
      )}

      {step === 'tipo' && (
        <StepList
          title="Tipo de movimentação"
          items={TYPE_OPTIONS.map((t) => ({ id: t, label: t === 'manutencao' ? 'Manutenção' : MOVEMENT_TYPE_LABEL[t] }))}
          onSelect={(id) => { set('type', id); next() }}
        />
      )}

      {step === 'responsavel' && (
        <StepList
          title="Selecione o responsável"
          items={responsibles.filter((r) => r.active).map((r) => ({ id: r.id, label: r.name, sub: r.sector }))}
          onSelect={(id) => { set('responsibleId', id); next() }}
          allowSkip
          onSkip={next}
        />
      )}

      {step === 'quantidade' && data.type !== 'manutencao' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-ink">Quantidade</h2>
          <Field label="Quantidade" required>
            <Input type="number" min="1" autoFocus value={data.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
          <Button className="w-full" onClick={next}>Continuar</Button>
        </div>
      )}
      {step === 'observacao' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-ink">{data.type === 'manutencao' ? 'Descreva o problema' : 'Observação'}</h2>
          <Textarea autoFocus value={data.notes} onChange={(e) => set('notes', e.target.value)} />
          <Button className="w-full" onClick={next}>Continuar</Button>
        </div>
      )}

      {step === 'revisao' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-ink">Revisar e confirmar</h2>
          <dl className="grid grid-cols-2 gap-y-2 rounded border border-ink/8 p-4 text-sm">
            <dt className="text-ink-faint">Equipamento</dt><dd className="text-ink">{equipment?.name}</dd>
            <dt className="text-ink-faint">Tipo</dt><dd className="text-ink">{data.type === 'manutencao' ? 'Manutenção' : MOVEMENT_TYPE_LABEL[data.type]}</dd>
            <dt className="text-ink-faint">Responsável</dt><dd className="text-ink">{responsible?.name || '-'}</dd>
            {data.type !== 'manutencao' && (<><dt className="text-ink-faint">Quantidade</dt><dd className="text-ink">{data.quantity}</dd></>)}
            <dt className="text-ink-faint">Observação</dt><dd className="text-ink">{data.notes || '-'}</dd>
          </dl>
          <Button className="w-full" onClick={confirm} loading={saving}>
            <Check size={16} /> Confirmar
          </Button>
        </div>
      )}
    </div>
  )
}

function StepList({ title, items, onSelect, allowSkip, onSkip }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="flex w-full flex-col items-start rounded-md border border-ink/10 bg-surface px-4 py-3 text-left hover:border-steel-500"
          >
            <span className="text-sm font-medium text-ink">{item.label}</span>
            {item.sub && <span className="text-xs text-ink-faint">{item.sub}</span>}
          </button>
        ))}
        {items.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">Nada disponível.</p>}
      </div>
      {allowSkip && (
        <button onClick={onSkip} className="w-full text-center text-sm text-steel-500">
          Pular esta etapa
        </button>
      )}
    </div>
  )
}
