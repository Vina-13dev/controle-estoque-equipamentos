import { useEffect, useState } from 'react'
import { subscribeUsers, setUserRole, setUserActive } from '../../services/usersService'
import { Table, THead, TRow, TCell, EmptyState } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import { Select } from '../../components/ui/Field'
import { ROLES } from '../../utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function UsuariosList() {
  const { profile, firebaseUser } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState(null)

  useEffect(() => subscribeUsers(setUsers), [])

  const actingUser = { uid: firebaseUser.uid, name: profile.name, email: profile.email }

  async function handleRoleChange(u, role) {
    try {
      await setUserRole(u.id, role, actingUser)
      toast.success('Permissão atualizada.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível atualizar a permissão.')
    }
  }

  async function handleActiveToggle(u) {
    try {
      await setUserActive(u.id, !u.active, actingUser)
      toast.success(u.active ? 'Usuário desativado.' : 'Usuário ativado.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível atualizar o status.')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Usuários</h1>
        <p className="text-sm text-ink-faint">
          Gerencie permissões e status. Para criar uma conta nova, adicione o usuário no Firebase Authentication
          e depois cadastre o perfil aqui com o mesmo UID (veja o README).
        </p>
      </div>

      {!users ? (
        <Loading />
      ) : (
        <Table>
          <THead columns={['Nome', 'E-mail', 'Perfil', 'Status']} />
          <tbody>
            {users.length === 0 && <EmptyState message="Nenhum usuário cadastrado." />}
            {users.map((u) => (
              <TRow key={u.id}>
                <TCell className="font-medium text-ink">{u.name}</TCell>
                <TCell>{u.email}</TCell>
                <TCell>
                  <Select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)} className="!py-1 text-xs">
                    <option value={ROLES.ADMIN}>Administrador</option>
                    <option value={ROLES.OPERADOR}>Operador</option>
                  </Select>
                </TCell>
                <TCell>
                  <button onClick={() => handleActiveToggle(u)}>
                    <Badge className={u.active !== false ? 'bg-moss-50 text-moss-600' : 'bg-surface-base text-ink-faint'}>
                      {u.active !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </button>
                </TCell>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
