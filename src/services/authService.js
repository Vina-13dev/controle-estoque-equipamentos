import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, firebaseConfig } from '../firebase/config'
import { normalizeUsername, usernameToEmail } from '../utils/helpers'

export async function createLocalUser({ name, username, password, role, allowedUnitIds }) {
  const cleanUsername = normalizeUsername(username)
  if (!cleanUsername) throw new Error('Informe um usuário válido.')
  if (!password || password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')

  const secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const email = usernameToEmail(cleanUsername)
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password)

    await setDoc(doc(db, 'stockUsers', credential.user.uid), {
      name: name.trim(),
      username: cleanUsername,
      email,
      role,
      active: true,
      allowedUnitIds: role === 'admin' ? ['*'] : allowedUnitIds,
      provider: 'password',
      createdAt: serverTimestamp(),
    })

    return credential.user.uid
  } finally {
    try {
      await signOut(secondaryAuth)
    } catch {}
    await deleteApp(secondaryApp)
  }
}
