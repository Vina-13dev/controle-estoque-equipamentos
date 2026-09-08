export default function Loading({ text = 'Carregando...' }) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  )
}
