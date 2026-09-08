import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Boxes } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'

export default function Login() {
  const {
    login,
    loginWithGoogle,
    isAuthenticated,
    loading: authLoading,
    error: authError,
  } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  if (!authLoading && isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password)
    } catch (err) {
      setError('E-mail ou senha inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleSubmitting(true)

    try {
      await loginWithGoogle()
    } catch (err) {
      console.error(err)

      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Login com Google cancelado.')
      } else if (err?.code === 'auth/popup-blocked') {
        setError('O navegador bloqueou a janela de login do Google.')
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError('Este domínio ainda não está autorizado no Firebase Authentication.')
      } else {
        setError('Não foi possível entrar com o Google.')
      }
    } finally {
      setGoogleSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt p-4">
      <div className="w-full max-w-sm rounded-md border border-ink/8 bg-surface p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-steel-500 text-white">
            <Boxes size={18} />
          </span>

          <div>
            <p className="text-sm font-semibold text-ink">Controle de Estoque</p>
            <p className="text-xs text-ink-faint">Equipamentos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="E-mail" required>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
          </Field>

          <Field label="Senha" required>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {(error || authError) && (
            <p className="text-sm text-brick-500">{error || authError}</p>
          )}

          <Button type="submit" className="w-full" loading={submitting}>
            Entrar
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-ink/10" />
          <span className="text-xs text-ink-faint">ou</span>
          <div className="h-px flex-1 bg-ink/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-base font-semibold">G</span>
          {googleSubmitting ? 'Entrando...' : 'Continuar com Google'}
        </button>
      </div>
    </div>
  )
}
