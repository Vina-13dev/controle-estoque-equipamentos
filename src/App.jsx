import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './routes/ProtectedRoute'
import AdminRoute from './routes/AdminRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EquipamentosList from './pages/Equipamentos/EquipamentosList'
import ResponsaveisList from './pages/Responsaveis/ResponsaveisList'
import Movimentacoes from './pages/Movimentacoes/Movimentacoes'
import MovimentacaoRapida from './pages/Movimentacoes/MovimentacaoRapida'
import Historico from './pages/Historico/Historico'
import Auditoria from './pages/Auditoria/Auditoria'
import Usuarios from './pages/Usuarios/UsuariosList'
import Manutencao from './pages/Manutencao/Manutencao'
import Relatorios from './pages/Relatorios/Relatorios'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="movimentacao-rapida" element={<MovimentacaoRapida />} />
        <Route path="equipamentos" element={<EquipamentosList />} />
        <Route path="responsaveis" element={<ResponsaveisList />} />
        <Route path="movimentacoes" element={<Movimentacoes />} />
        <Route path="manutencao" element={<Manutencao />} />
        <Route path="historico" element={<Historico />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route
          path="auditoria"
          element={
            <AdminRoute>
              <Auditoria />
            </AdminRoute>
          }
        />
        <Route
          path="usuarios"
          element={
            <AdminRoute>
              <Usuarios />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
