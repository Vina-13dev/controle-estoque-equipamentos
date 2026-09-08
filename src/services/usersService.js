import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export async function listUsers() {
  const snap = await getDocs(collection(db, 'stockUsers'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', 'pt-BR'))
}

export async function updateUserProfile(id, data) {
  return updateDoc(doc(db, 'stockUsers', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
