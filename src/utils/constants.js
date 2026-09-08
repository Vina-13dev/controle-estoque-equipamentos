export const ROLES = {
  ADMIN: 'admin',
  OPERADOR: 'operador',
}

export const EQUIPMENT_STATUS = {
  DISPONIVEL: 'disponivel',
  EM_USO: 'em_uso',
  EM_MANUTENCAO: 'em_manutencao',
  DANIFICADO: 'danificado',
  BAIXADO: 'baixado',
}

export const EQUIPMENT_STATUS_LABEL = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  em_manutencao: 'Em manutenção',
  danificado: 'Danificado',
  baixado: 'Baixado',
}

export const EQUIPMENT_STATUS_BADGE = {
  disponivel: 'bg-moss-50 text-moss-600',
  em_uso: 'bg-steel-50 text-steel-600',
  em_manutencao: 'bg-amber-50 text-amber-600',
  danificado: 'bg-brick-50 text-brick-600',
  baixado: 'bg-surface-base text-ink-faint',
}

export const MOVEMENT_TYPES = {
  ENTRADA: 'entrada',
  SAIDA: 'saida',
  DEVOLUCAO: 'devolucao',
  BAIXA: 'baixa',
  AJUSTE: 'ajuste',
  CORRECAO: 'correcao',
}

export const MOVEMENT_TYPE_LABEL = {
  entrada: 'Entrada',
  saida: 'Saída',
  devolucao: 'Devolução',
  baixa: 'Baixa',
  ajuste: 'Ajuste',
  correcao: 'Correção',
}

// Movimentações que aumentam a quantidade disponível em estoque
export const STOCK_INCREASE_TYPES = ['entrada', 'devolucao']
// Movimentações que diminuem a quantidade disponível em estoque
export const STOCK_DECREASE_TYPES = ['saida', 'baixa']

export const MAINTENANCE_STATUS = {
  ABERTA: 'aberta',
  EM_MANUTENCAO: 'em_manutencao',
  AGUARDANDO_PECA: 'aguardando_peca',
  FINALIZADA: 'finalizada',
  CANCELADA: 'cancelada',
}

export const MAINTENANCE_STATUS_LABEL = {
  aberta: 'Aberta',
  em_manutencao: 'Em manutenção',
  aguardando_peca: 'Aguardando peça',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  MOVEMENT: 'movement',
  CORRECTION: 'correction',
  MAINTENANCE: 'maintenance',
  USER_CHANGE: 'user_change',
  PERMISSION_CHANGE: 'permission_change',
  SETTINGS_CHANGE: 'settings_change',
}
