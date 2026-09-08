import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { logAudit } from './auditService'
import { AUDIT_ACTIONS } from '../utils/constants'

const COLLECTION = 'users'

export function subscribeUsers(callback) {
  const q = query(collection(db, COLLECTION), orderBy('name'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Cria/atualiza o documento de perfil de um usuário em /users/{uid}.
 * IMPORTANTE: isto NÃO cria a conta no Firebase Authentication - isso deve
 * ser feito separadamente (Firebase Console ou fluxo de convite), pois
 * criar usuários de Auth a partir do app requer o Admin SDK (backend).
 * Aqui apenas gerenciamos o perfil/permissões dentro do Firestore.
 */
export async function upsertUserProfile(uid, data, actingUser) {
  const ref = doc(db, COLLECTION, uid)
  const before = (await getDoc(ref)).exists() ? (await getDoc(ref)).data() : null
  const payload = {
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active !== false,
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, payload, { merge: true })
  await logAudit({
    user: actingUser,
    action: before ? AUDIT_ACTIONS.USER_CHANGE : AUDIT_ACTIONS.CREATE,
    entity: 'user',
    entityId: uid,
    before,
    after: payload,
    description: `Perfil de usuário "${payload.name}" ${before ? 'atualizado' : 'criado'}.`,
  })
}

export async function setUserRole(uid, role, actingUser) {
  await updateDoc(doc(db, COLLECTION, uid), { role, updatedAt: serverTimestamp() })
  await logAudit({
    user: actingUser,
    action: AUDIT_ACTIONS.PERMISSION_CHANGE,
    entity: 'user',
    entityId: uid,
    after: { role },
    description: `Perfil de permissão alterado para "${role}".`,
  })
}

export async function setUserActive(uid, active, actingUser) {
  await updateDoc(doc(db, COLLECTION, uid), { active, updatedAt: serverTimestamp() })
  await logAudit({
    user: actingUser,
    action: AUDIT_ACTIONS.USER_CHANGE,
    entity: 'user',
    entityId: uid,
    after: { active },
    description: `Usuário ${active ? 'ativado' : 'desativado'}.`,
  })
}
