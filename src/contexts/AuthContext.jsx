import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { usernameToEmail } from '../utils/helpers'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

async function ensureProfile(user) {
  const userRef = doc(db, 'stockUsers', user.uid)
  const bootstrapRef = doc(db, 'stockSystem', 'bootstrap')

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef)
    const bootstrapSnap = await tx.get(bootstrapRef)

    if (userSnap.exists()) {
      if (!bootstrapSnap.exists() && userSnap.data().role === 'admin') {
        tx.set(bootstrapRef, {
          adminUid: user.uid,
          createdAt: serverTimestamp(),
        })
      }
      return
    }

    const baseProfile = {
      name: user.displayName || user.email?.split('@')[0] || 'Usuário',
      email: user.email || '',
      username: '',
      provider: user.providerData?.[0]?.providerId || 'firebase',
      createdAt: serverTimestamp(),
    }

    if (!bootstrapSnap.exists()) {
      tx.set(bootstrapRef, {
        adminUid: user.uid,
        createdAt: serverTimestamp(),
      })
      tx.set(userRef, {
        ...baseProfile,
        role: 'admin',
        active: true,
        allowedUnitIds: ['*'],
      })
    } else {
      tx.set(userRef, {
        ...baseProfile,
        role: 'operator',
        active: false,
        allowedUnitIds: [],
      })
    }
  })

  const finalSnap = await getDoc(userRef)
  return finalSnap.exists() ? { id: finalSnap.id, ...finalSnap.data() } : null
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      setError('')

      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const loadedProfile = await ensureProfile(user)
        setProfile(loadedProfile)
      } catch (err) {
        console.error('Falha ao carregar perfil:', err)
        setProfile(null)
        setError(err?.message || 'Não foi possível carregar seu perfil.')
      } finally {
        setLoading(false)
      }
    })
  }, [])

  async function loginWithGoogle() {
    setError('')
    return signInWithPopup(auth, googleProvider)
  }

  async function loginWithUsername(username, password) {
    setError('')
    return signInWithEmailAndPassword(auth, usernameToEmail(username), password)
  }

  async function logout() {
    await signOut(auth)
  }

  async function refreshProfile() {
    if (!auth.currentUser) return
    const snap = await getDoc(doc(db, 'stockUsers', auth.currentUser.uid))
    setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  }

  const value = useMemo(() => ({
    firebaseUser,
    profile,
    loading,
    error,
    isAdmin: profile?.role === 'admin',
    isActive: profile?.active === true,
    loginWithGoogle,
    loginWithUsername,
    logout,
    refreshProfile,
  }), [firebaseUser, profile, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
