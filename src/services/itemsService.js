import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export async function listItems(unitId = null) {
  const ref = collection(db, 'stockItems')
  const snap = unitId
    ? await getDocs(query(ref, where('unitId', '==', unitId)))
    : await getDocs(ref)

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
}

export async function createItem({ unitId, name, category, measure, minimum, note, user }) {
  return addDoc(collection(db, 'stockItems'), {
    unitId,
    name: name.trim(),
    category: category.trim(),
    measure,
    minimum: Number(minimum || 0),
    note: note.trim(),
    quantity: 0,
    active: true,
    createdBy: user.uid,
    createdByName: user.name,
    createdAt: serverTimestamp(),
  })
}

export async function updateItem(id, data, user) {
  return updateDoc(doc(db, 'stockItems', id), {
    ...data,
    minimum: Number(data.minimum || 0),
    updatedBy: user.uid,
    updatedByName: user.name,
    updatedAt: serverTimestamp(),
  })
}

// Exclusão segura: o produto some do estoque e não pode mais ser movimentado,
// mas o documento é mantido para preservar todo o histórico já registrado.
export async function archiveItem(id, user) {
  return updateDoc(doc(db, 'stockItems', id), {
    active: false,
    updatedBy: user.uid,
    updatedByName: user.name,
    updatedAt: serverTimestamp(),
  })
}
