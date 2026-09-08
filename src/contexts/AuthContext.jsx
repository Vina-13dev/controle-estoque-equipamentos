import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { usernameToEmail } from '../utils/helpers'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

const ROOT_ADMIN_UID = 'RHvPSwuTEeY0alV2aWgTbRWPuBt1'

function rootAdminProfile(user) {
  return {
    id: user.uid,
    name: user.displayName || 'Administrador',
    email: user.email || '',
    username: '',
    provider: 'google.com',
    role: 'admin',
    active: true,
    allowedUnitIds: ['*'],
  }
}

async function loadOrCreateProfile(user) {
  // IMPORTANTE:
  // O administrador principal NÃO depende do Firestore para conseguir entrar.
  // Isso evita travar o sistema durante o bootstrap inicial.
  if (user.uid === ROOT_ADMIN_UID) {
    return rootAdminProfile(user)
  }

  const userRef = doc(db, 'stockUsers', user.uid)
  let snap = await getDoc(userRef)

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() }
  }

  // Contas Google novas entram como pendentes até o administrador liberar.
  await setDoc(userRef, {
    name: user.displayName || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    username: '',
    provider: user.providerData?.[0]?.providerId || 'firebase',
    role: 'operator',
    active: false,
    allowedUnitIds: [],
    createdAt: serverTimestamp(),
  })

  snap = await getDoc(userRef)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
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
        const loadedProfile = await loadOrCreateProfile(user)

        if (!loadedProfile) {
          throw new Error('Perfil não encontrado.')
        }

        setProfile(loadedProfile)
      } catch (err) {
        console.error('Falha ao carregar/criar perfil:', err)
        setProfile(null)
        setError(
          err?.code
            ? `${err.code}: ${err.message}`
            : err?.message || 'Não foi possível carregar seu perfil.',
        )
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

    try {
      const loadedProfile = await loadOrCreateProfile(auth.currentUser)
      setProfile(loadedProfile)
      setError('')
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Não foi possível atualizar seu perfil.')
    }
  }

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      error,
      isAdmin: firebaseUser?.uid === ROOT_ADMIN_UID || profile?.role === 'admin',
      isActive: firebaseUser?.uid === ROOT_ADMIN_UID || profile?.active === true,
      loginWithGoogle,
      loginWithUsername,
      logout,
      refreshProfile,
    }),
    [firebaseUser, profile, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
