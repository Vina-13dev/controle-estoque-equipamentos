import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loading from './Loading'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { firebaseUser, profile, loading, isAdmin, isActive } = useAuth()

  if (loading) return <Loading />
  if (!firebaseUser || !profile || !isActive) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}
