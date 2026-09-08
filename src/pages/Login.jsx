import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Boxes, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'

export default function Login() {
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
          </Field>
          <Field label="Senha" required>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>

          {error && <p className="text-sm text-brick-500">{error}</p>}

          <Button type="submit" className="w-full" loading={submitting}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
