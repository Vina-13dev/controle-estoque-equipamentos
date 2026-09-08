import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export async function registerMovement({ unitId, itemId, type, quantity, note, user }) {
  const movementRef = doc(collection(db, 'stockMovements'))
  const itemRef = doc(db, 'stockItems', itemId)

  await runTransaction(db, async (tx) => {
    const itemSnap = await tx.get(itemRef)
    if (!itemSnap.exists()) throw new Error('Item não encontrado.')

    const item = itemSnap.data()
    if (item.unitId !== unitId) throw new Error('Este item pertence a outra unidade.')
    if (item.active === false) throw new Error('Este item foi removido do estoque.')

    const beforeQty = Number(item.quantity || 0)
    const amount = Number(quantity)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Quantidade inválida.')

    let afterQty = beforeQty
    if (type === 'entrada') {
      if (amount <= 0) throw new Error('Informe uma quantidade maior que zero.')
      afterQty = beforeQty + amount
    } else if (type === 'saida') {
      if (amount <= 0) throw new Error('Informe uma quantidade maior que zero.')
      afterQty = beforeQty - amount
      if (afterQty < 0) throw new Error('Quantidade indisponível em estoque.')
    } else if (type === 'ajuste') {
      afterQty = amount
    } else {
      throw new Error('Tipo de movimentação inválido.')
    }

    tx.set(movementRef, {
      unitId,
      itemId,
      itemName: item.name,
      itemCategory: item.category || '',
      measure: item.measure || 'un',
      type,
      quantity: amount,
      delta: afterQty - beforeQty,
      beforeQty,
      afterQty,
      note: (note || '').trim(),
      createdBy: user.uid,
      createdByName: user.name,
      createdAt: serverTimestamp(),
    })

    tx.update(itemRef, {
      quantity: afterQty,
      lastMovementId: movementRef.id,
      updatedBy: user.uid,
      updatedByName: user.name,
      updatedAt: serverTimestamp(),
    })
  })

  return movementRef.id
}

export async function listMovements(unitId = null) {
  const ref = collection(db, 'stockMovements')
  const snap = unitId
    ? await getDocs(query(ref, where('unitId', '==', unitId)))
    : await getDocs(ref)

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0
      const tb = b.createdAt?.toMillis?.() || 0
      return tb - ta
    })
}
