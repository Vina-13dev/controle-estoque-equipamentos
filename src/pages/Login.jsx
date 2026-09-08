import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Boxes, LogIn, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const {
    firebaseUser,
    profile,
    loading,
    error: authError,
    isActive,
    loginWithGoogle,
    loginWithUsername,
    logout,
    refreshProfile,
  } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && firebaseUser && profile && isActive) return <Navigate to="/" replace />

  async function handleLocal(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await loginWithUsername(username, password)
    } catch (err) {
      console.error(err)
      setError('Usuário ou senha inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSubmitting(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      console.error(err)
      if (err?.code === 'auth/popup-closed-by-user') setError('Login com Google cancelado.')
      else if (err?.code === 'auth/unauthorized-domain') setError('Domínio não autorizado no Firebase Authentication.')
      else setError('Não foi possível entrar com o Google.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && firebaseUser && profile && !isActive) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-icon large"><Boxes size={24} /></span>
            <div><strong>Controle de Estoque</strong><small>Assistência Social</small></div>
          </div>
          <div className="pending-box">
            <h2>Aguardando autorização</h2>
            <p>Sua conta foi identificada, mas um administrador ainda precisa liberar sua unidade e seu acesso.</p>
            <strong>{profile.name || firebaseUser.email}</strong>
          </div>
          <button className="btn secondary full" onClick={refreshProfile}><RefreshCw size={17} /> Verificar novamente</button>
          <button className="btn ghost full" onClick={logout}>Sair desta conta</button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-icon large"><Boxes size={24} /></span>
          <div><strong>Controle de Estoque</strong><small>Assistência Social</small></div>
        </div>

        <h1>Entrar</h1>
        <p className="muted">Use seu usuário e senha ou sua conta Google.</p>

        <form onSubmit={handleLocal} className="form-stack">
          <label className="field">
            <span>Usuário</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex.: maria" autoComplete="username" required />
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" required />
          </label>
          {(error || authError) && <div className="alert error">{error || authError}</div>}
          <button className="btn primary full" disabled={submitting}><LogIn size={17} /> {submitting ? 'Entrando...' : 'Entrar'}</button>
        </form>

        <div className="divider"><span>ou</span></div>
        <button className="btn google full" onClick={handleGoogle} disabled={submitting}>
          <span className="google-g">G</span> Continuar com Google
        </button>
        <p className="login-tip">No primeiro acesso de um sistema vazio, a primeira conta autenticada vira administradora automaticamente.</p>
      </div>
    </div>
  )
}
