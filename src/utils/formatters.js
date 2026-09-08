import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDateTime(value) {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatDate(value) {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Gera um número sequencial legível a partir de um contador do Firestore
export function formatSequence(n) {
  return `#${String(n).padStart(4, '0')}`
}
