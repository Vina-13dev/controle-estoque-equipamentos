import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
      <p className="text-2xl font-semibold text-ink">404</p>
      <p className="text-ink-faint">Página não encontrada.</p>
      <Link to="/" className="text-sm text-steel-500 underline">Voltar ao painel</Link>
    </div>
  )
}
