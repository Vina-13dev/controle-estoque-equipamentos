import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { ROLES } from '../utils/constants'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()

// Primeiro administrador do sistema.
// Esse UID pode criar automaticamente o próprio perfil como admin.
const FIRST_ADMIN_UID = 'RHvPSwuTEeY0alV2aWgTbRWPuBt1'

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setError(null)

      if (!user) {
        setFirebaseUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setFirebaseUser(user)
      setLoading(true)

      try {
        const userRef = doc(db, 'users', user.uid)
        let snap = await getDoc(userRef)

        // Se o usuário autenticou mas ainda não possui perfil,
        // o sistema cria automaticamente.
        if (!snap.exists()) {
          const isFirstAdmin = user.uid === FIRST_ADMIN_UID

          const initialProfile = {
            name: user.displayName || user.email?.split('@')[0] || 'Usuário',
            email: user.email || '',
            role: isFirstAdmin ? ROLES.ADMIN : ROLES.OPERADOR,
            active: isFirstAdmin,
            allowedUnits: isFirstAdmin ? ['*'] : [],
            createdAt: serverTimestamp(),
            createdBy: 'automatic',
            provider: user.providerData?.[0]?.providerId || 'firebase',
          }

          await setDoc(userRef, initialProfile)
          snap = await getDoc(userRef)
        }

        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() })
        } else {
          setProfile(null)
          setError('Não foi possível criar ou carregar seu perfil de usuário.')
        }
      } catch (err) {
        console.error(err)
        setProfile(null)
        setError('Não foi possível criar ou carregar seu perfil de usuário.')
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  async function login(email, password) {
    setError(null)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  async function loginWithGoogle() {
    setError(null)
    const cred = await signInWithPopup(auth, googleProvider)
    return cred.user
  }

  async function logout() {
    await firebaseSignOut(auth)
  }

  const isAdmin = profile?.role === ROLES.ADMIN
  const isActive = profile?.active !== false

  const value = {
    firebaseUser,
    profile,
    loading,
    error,
    login,
    loginWithGoogle,
    logout,
    isAdmin,
    isActive,
    isAuthenticated: !!firebaseUser && !!profile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
