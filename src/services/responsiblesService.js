import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { logAudit } from './auditService'
import { AUDIT_ACTIONS } from '../utils/constants'

const COLLECTION = 'responsibles'

export function subscribeResponsibles(callback) {
  const q = query(collection(db, COLLECTION), orderBy('name'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function createResponsible(data, user) {
  const payload = {
    name: data.name,
    sector: data.sector || '',
    role: data.role || '',
    phone: data.phone || '',
    email: data.email || '',
    notes: data.notes || '',
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
  }
  const ref = await addDoc(collection(db, COLLECTION), payload)
  await logAudit({
    user,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'responsible',
    entityId: ref.id,
    after: payload,
    description: `Responsável "${payload.name}" cadastrado.`,
  })
  return ref.id
}

export async function updateResponsible(id, changes, user) {
  const beforeSnap = await getDoc(doc(db, COLLECTION, id))
  const before = beforeSnap.exists() ? beforeSnap.data() : null
  await updateDoc(doc(db, COLLECTION, id), { ...changes, updatedAt: serverTimestamp() })
  await logAudit({
    user,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'responsible',
    entityId: id,
    before,
    after: { ...before, ...changes },
    description: `Responsável "${before?.name || id}" alterado.`,
  })
}
