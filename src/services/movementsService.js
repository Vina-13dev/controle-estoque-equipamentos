import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { logAudit } from './auditService'
import {
  AUDIT_ACTIONS,
  MOVEMENT_TYPES,
  STOCK_INCREASE_TYPES,
  STOCK_DECREASE_TYPES,
} from '../utils/constants'

const MOVEMENTS = 'movements'
const EQUIPMENTS = 'equipments'
const COUNTERS = 'counters'

/**
 * Retorna o delta de estoque (positivo aumenta, negativo diminui) para um
 * tipo de movimentação + quantidade. 'ajuste' usa a própria quantidade como
 * delta assinado (pode ser negativo). 'correcao' não mexe direto no estoque
 * por si só - o efeito é calculado revertendo a movimentação original e
 * aplicando os dados corrigidos (ver createCorrection).
 */
function stockDelta(type, quantity) {
  if (STOCK_INCREASE_TYPES.includes(type)) return Math.abs(quantity)
  if (STOCK_DECREASE_TYPES.includes(type)) return -Math.abs(quantity)
  if (type === MOVEMENT_TYPES.AJUSTE) return Number(quantity)
  return 0
}

async function nextSequence(transaction) {
  const counterRef = doc(db, COUNTERS, 'movements')
  const counterSnap = await transaction.get(counterRef)
  const current = counterSnap.exists() ? counterSnap.data().value || 0 : 0
  const next = current + 1
  transaction.set(counterRef, { value: next }, { merge: true })
  return next
}

export function subscribeMovements(callback) {
  const q = query(collection(db, MOVEMENTS), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getMovement(id) {
  const snap = await getDoc(doc(db, MOVEMENTS, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/**
 * Cria uma movimentação (entrada, saída, devolução, baixa ou ajuste) dentro
 * de uma transação do Firestore, garantindo:
 *  - numeração sequencial única
 *  - estoque nunca fica negativo
 *  - atualização atômica da quantidade do equipamento
 */
export async function createMovement({ type, equipmentId, quantity, responsibleId, responsibleName, sector, reason, notes }, user) {
  const equipmentRef = doc(db, EQUIPMENTS, equipmentId)

  const result = await runTransaction(db, async (transaction) => {
    const equipmentSnap = await transaction.get(equipmentRef)
    if (!equipmentSnap.exists()) {
      throw new Error('Equipamento não encontrado.')
    }
    const equipment = equipmentSnap.data()
    const delta = stockDelta(type, quantity)
    const newQuantity = (equipment.quantity || 0) + delta

    if (newQuantity < 0) {
      throw new Error('Quantidade indisponível em estoque.')
    }

    const sequence = await nextSequence(transaction)
    const movementRef = doc(collection(db, MOVEMENTS))

    const movementData = {
      sequence,
      type,
      equipmentId,
      equipmentName: equipment.name,
      quantity: Math.abs(Number(quantity)),
      stockDelta: delta,
      responsibleId: responsibleId || null,
      responsibleName: responsibleName || null,
      sector: sector || equipment.sector || '',
      reason: reason || '',
      notes: notes || '',
      relatedMovementId: null,
      immutable: true,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByName: user.name || user.email,
    }

    transaction.set(movementRef, movementData)
    transaction.update(equipmentRef, { quantity: newQuantity, updatedAt: serverTimestamp() })

    return { id: movementRef.id, ...movementData, newQuantity }
  })

  await logAudit({
    user,
    action: AUDIT_ACTIONS.MOVEMENT,
    entity: 'movement',
    entityId: result.id,
    after: result,
    description: `Movimentação ${MOVEMENT_TYPES[type.toUpperCase()] ? '' : ''}#${result.sequence} (${type}) registrada para "${result.equipmentName}".`,
  })

  return result
}

/**
 * Cria uma movimentação de CORREÇÃO/ESTORNO vinculada a uma movimentação
 * original. A movimentação original NUNCA é alterada ou apagada.
 *
 * A correção reverte o efeito de estoque da movimentação original e aplica
 * o efeito dos dados corrigidos (que podem ser o mesmo equipamento/tipo com
 * apenas o responsável trocado, ou valores diferentes).
 */
export async function createCorrection({ originalMovementId, corrected, reason }, user) {
  const originalRef = doc(db, MOVEMENTS, originalMovementId)

  const result = await runTransaction(db, async (transaction) => {
    const originalSnap = await transaction.get(originalRef)
    if (!originalSnap.exists()) throw new Error('Movimentação original não encontrada.')
    const original = originalSnap.data()

    const correctedType = corrected.type || original.type
    const correctedEquipmentId = corrected.equipmentId || original.equipmentId
    const correctedQuantity = corrected.quantity ?? original.quantity

    // Reverter efeito da movimentação original no equipamento original
    const originalEquipmentRef = doc(db, EQUIPMENTS, original.equipmentId)
    const originalEquipmentSnap = await transaction.get(originalEquipmentRef)
    if (!originalEquipmentSnap.exists()) throw new Error('Equipamento original não encontrado.')
    const originalEquipment = originalEquipmentSnap.data()
    const reverseDelta = -(original.stockDelta || stockDelta(original.type, original.quantity))
    let originalNewQuantity = (originalEquipment.quantity || 0) + reverseDelta

    const sameEquipment = correctedEquipmentId === original.equipmentId

    if (sameEquipment) {
      // Aplica reversão + novo efeito no mesmo documento
      const newDelta = stockDelta(correctedType, correctedQuantity)
      originalNewQuantity = originalNewQuantity + newDelta
      if (originalNewQuantity < 0) throw new Error('Quantidade indisponível em estoque.')
      transaction.update(originalEquipmentRef, { quantity: originalNewQuantity, updatedAt: serverTimestamp() })
    } else {
      if (originalNewQuantity < 0) throw new Error('Quantidade indisponível em estoque no equipamento original.')
      transaction.update(originalEquipmentRef, { quantity: originalNewQuantity, updatedAt: serverTimestamp() })

      const newEquipmentRef = doc(db, EQUIPMENTS, correctedEquipmentId)
      const newEquipmentSnap = await transaction.get(newEquipmentRef)
      if (!newEquipmentSnap.exists()) throw new Error('Equipamento corrigido não encontrado.')
      const newEquipment = newEquipmentSnap.data()
      const newDelta = stockDelta(correctedType, correctedQuantity)
      const newEquipmentQuantity = (newEquipment.quantity || 0) + newDelta
      if (newEquipmentQuantity < 0) throw new Error('Quantidade indisponível em estoque no equipamento corrigido.')
      transaction.update(newEquipmentRef, { quantity: newEquipmentQuantity, updatedAt: serverTimestamp() })
    }

    const sequence = await nextSequence(transaction)
    const correctionRef = doc(collection(db, MOVEMENTS))
    const correctionData = {
      sequence,
      type: MOVEMENT_TYPES.CORRECAO,
      equipmentId: correctedEquipmentId,
      equipmentName: corrected.equipmentName || original.equipmentName,
      quantity: Math.abs(Number(correctedQuantity)),
      stockDelta: stockDelta(correctedType, correctedQuantity),
      responsibleId: corrected.responsibleId || original.responsibleId,
      responsibleName: corrected.responsibleName || original.responsibleName,
      sector: corrected.sector || original.sector,
      reason: reason || '',
      notes: corrected.notes || '',
      relatedMovementId: originalMovementId,
      relatedMovementSequence: original.sequence,
      correctedFromType: original.type,
      immutable: true,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByName: user.name || user.email,
    }
    transaction.set(correctionRef, correctionData)

    return { id: correctionRef.id, ...correctionData, original }
  })

  await logAudit({
    user,
    action: AUDIT_ACTIONS.CORRECTION,
    entity: 'movement',
    entityId: result.id,
    before: result.original,
    after: result,
    description: `Correção #${result.sequence} registrada, referente à movimentação #${result.relatedMovementSequence}.`,
  })

  return result
}
