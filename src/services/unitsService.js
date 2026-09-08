import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export async function listUnits() {
  const snap = await getDocs(query(collection(db, 'stockUnits'), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getUnitsByIds(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))]
  const snaps = await Promise.all(unique.map((id) => getDoc(doc(db, 'stockUnits', id))))
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
}

export async function createUnit(name) {
  return addDoc(collection(db, 'stockUnits'), {
    name: name.trim(),
    active: true,
    createdAt: serverTimestamp(),
  })
}

export async function updateUnit(id, data) {
  return updateDoc(doc(db, 'stockUnits', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
