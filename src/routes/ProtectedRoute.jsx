import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loading from '../components/ui/Loading'

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated, isActive, error, logout } = useAuth()

  if (loading) return <Loading label="Verificando sessão..." />

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (!isActive) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-ink">Seu usuário está inativo. Fale com um administrador.</p>
        <button onClick={logout} className="text-sm text-steel-500 underline">
          Sair
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="max-w-md text-ink">{error}</p>
        <button onClick={logout} className="text-sm text-steel-500 underline">
          Sair
        </button>
      </div>
    )
  }

  return children
}
