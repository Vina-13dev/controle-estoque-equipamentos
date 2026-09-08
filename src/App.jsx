import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Move from './pages/Move'
import History from './pages/History'
import AdminUsers from './pages/AdminUsers'
import AdminUnits from './pages/AdminUnits'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="estoque" element={<Stock />} />
        <Route path="movimentar" element={<Move />} />
        <Route path="historico" element={<History />} />
        <Route path="admin/usuarios" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
        <Route path="admin/unidades" element={<ProtectedRoute adminOnly><AdminUnits /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
