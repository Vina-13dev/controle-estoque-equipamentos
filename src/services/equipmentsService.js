import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { logAudit } from './auditService'
import { AUDIT_ACTIONS, EQUIPMENT_STATUS } from '../utils/constants'

const COLLECTION = 'equipments'

export function subscribeEquipments(callback) {
  const q = query(collection(db, COLLECTION), orderBy('name'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getEquipment(id) {
  const snap = await getDoc(doc(db, COLLECTION, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createEquipment(data, user) {
  const payload = {
    code: data.code || '',
    name: data.name,
    description: data.description || '',
    assetTag: data.assetTag || '',
    serialNumber: data.serialNumber || '',
    brand: data.brand || '',
    model: data.model || '',
    quantity: Number(data.quantity) || 0,
    minStock: Number(data.minStock) || 0,
    location: data.location || '',
    sector: data.sector || '',
    status: data.status || EQUIPMENT_STATUS.DISPONIVEL,
    notes: data.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
    createdByName: user.name || user.email,
    updatedBy: user.uid,
    updatedByName: user.name || user.email,
  }
  const ref = await addDoc(collection(db, COLLECTION), payload)
  await logAudit({
    user,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'equipment',
    entityId: ref.id,
    after: payload,
    description: `Equipamento "${payload.name}" cadastrado.`,
  })
  return ref.id
}

export async function updateEquipment(id, changes, user) {
  const before = await getEquipment(id)
  const payload = {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByName: user.name || user.email,
  }
  await updateDoc(doc(db, COLLECTION, id), payload)
  await logAudit({
    user,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'equipment',
    entityId: id,
    before,
    after: { ...before, ...changes },
    description: `Equipamento "${before?.name || id}" alterado.`,
  })
}

export async function listEquipmentsOnce() {
  const snap = await getDocs(collection(db, COLLECTION))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
