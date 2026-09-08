import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Registra uma entrada de auditoria. Nunca deve ser editada ou apagada pela
 * interface - as Firestore Security Rules bloqueiam update/delete em
 * auditLogs para todos os perfis (ver firestore.rules).
 *
 * @param {object} params
 * @param {object} params.user - { uid, name, email }
 * @param {string} params.action - ver utils/constants.js AUDIT_ACTIONS
 * @param {string} params.entity - ex: 'equipment', 'responsible', 'movement'
 * @param {string} params.entityId
 * @param {object|null} params.before - dados anteriores (para updates)
 * @param {object|null} params.after - dados novos
 * @param {string} [params.description]
 */
export async function logAudit({ user, action, entity, entityId, before = null, after = null, description = '' }) {
  await addDoc(collection(db, 'auditLogs'), {
    userId: user?.uid || null,
    userName: user?.name || user?.email || 'desconhecido',
    action,
    entity,
    entityId,
    before,
    after,
    description,
    createdAt: serverTimestamp(),
  })
}
