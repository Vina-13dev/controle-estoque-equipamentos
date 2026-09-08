import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { logAudit } from './auditService'
import { AUDIT_ACTIONS, EQUIPMENT_STATUS, MAINTENANCE_STATUS } from '../utils/constants'

const COLLECTION = 'maintenance'
const EQUIPMENTS = 'equipments'

export function subscribeMaintenance(callback) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Abre um chamado de manutenção e move o equipamento para o status
 * "em_manutencao" atomicamente.
 */
export async function openMaintenance(data, user) {
  const equipmentRef = doc(db, EQUIPMENTS, data.equipmentId)

  const result = await runTransaction(db, async (transaction) => {
    const equipmentSnap = await transaction.get(equipmentRef)
    if (!equipmentSnap.exists()) throw new Error('Equipamento não encontrado.')

    const maintenanceRef = doc(collection(db, COLLECTION))
    const payload = {
      equipmentId: data.equipmentId,
      equipmentName: equipmentSnap.data().name,
      problem: data.problem || '',
      entryDate: data.entryDate || serverTimestamp(),
      responsibleId: data.responsibleId || null,
      responsibleName: data.responsibleName || null,
      technician: data.technician || '',
      cost: data.cost ? Number(data.cost) : null,
      notes: data.notes || '',
      expectedReturnDate: data.expectedReturnDate || null,
      actualReturnDate: null,
      status: MAINTENANCE_STATUS.ABERTA,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByName: user.name || user.email,
    }
    transaction.set(maintenanceRef, payload)
    transaction.update(equipmentRef, { status: EQUIPMENT_STATUS.EM_MANUTENCAO, updatedAt: serverTimestamp() })
    return { id: maintenanceRef.id, ...payload }
  })

  await logAudit({
    user,
    action: AUDIT_ACTIONS.MAINTENANCE,
    entity: 'maintenance',
    entityId: result.id,
    after: result,
    description: `Manutenção aberta para "${result.equipmentName}".`,
  })

  return result
}

/**
 * Atualiza status/dados de uma manutenção. Quando finalizada ou cancelada,
 * o equipamento volta para "disponivel" automaticamente.
 */
export async function updateMaintenance(id, changes, equipmentId, user) {
  const equipmentRef = doc(db, EQUIPMENTS, equipmentId)

  await runTransaction(db, async (transaction) => {
    const maintenanceRef = doc(db, COLLECTION, id)
    transaction.update(maintenanceRef, { ...changes, updatedAt: serverTimestamp() })

    if (changes.status === MAINTENANCE_STATUS.FINALIZADA || changes.status === MAINTENANCE_STATUS.CANCELADA) {
      transaction.update(equipmentRef, { status: EQUIPMENT_STATUS.DISPONIVEL, updatedAt: serverTimestamp() })
    }
  })

  await logAudit({
    user,
    action: AUDIT_ACTIONS.MAINTENANCE,
    entity: 'maintenance',
    entityId: id,
    after: changes,
    description: `Manutenção atualizada (status: ${changes.status || 'sem alteração'}).`,
  })
}
