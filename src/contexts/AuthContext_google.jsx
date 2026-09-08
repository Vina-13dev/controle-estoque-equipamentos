import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { ROLES } from '../utils/constants'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // documento em /users/{uid}
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

      try {
        const snap = await getDoc(doc(db, 'users', user.uid))

        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() })
        } else {
          setProfile(null)
          setError(
            'Sua conta foi autenticada, mas ainda não possui perfil no sistema. ' +
              'Crie um documento em /users usando este UID: ' +
              user.uid
          )
        }
      } catch (err) {
        console.error(err)
        setError('Não foi possível carregar seu perfil de usuário.')
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
