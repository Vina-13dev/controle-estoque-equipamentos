import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { getUnitsByIds, listUnits } from '../services/unitsService'

const UnitContext = createContext(null)

export function UnitProvider({ children }) {
  const { profile, isAdmin, isActive } = useAuth()
  const [units, setUnits] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loadingUnits, setLoadingUnits] = useState(false)

  async function refreshUnits() {
    if (!profile || !isActive) {
      setUnits([])
      return
    }
    setLoadingUnits(true)
    try {
      const visible = isAdmin
        ? await listUnits()
        : await getUnitsByIds(profile.allowedUnitIds || [])
      setUnits(visible)

      setSelectedUnitId((current) => {
        if (isAdmin && current === 'all') return 'all'
        if (visible.some((u) => u.id === current)) return current
        if (isAdmin) return visible.length ? 'all' : ''
        return visible[0]?.id || ''
      })
    } finally {
      setLoadingUnits(false)
    }
  }

  useEffect(() => {
    refreshUnits()
  }, [profile?.id, profile?.active, profile?.role, JSON.stringify(profile?.allowedUnitIds || [])])

  const selectedUnit = selectedUnitId === 'all'
    ? null
    : units.find((u) => u.id === selectedUnitId) || null

  const value = useMemo(() => ({
    units,
    selectedUnitId,
    selectedUnit,
    setSelectedUnitId,
    loadingUnits,
    refreshUnits,
  }), [units, selectedUnitId, selectedUnit, loadingUnits])

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>
}

export function useUnits() {
  const ctx = useContext(UnitContext)
  if (!ctx) throw new Error('useUnits precisa estar dentro de UnitProvider')
  return ctx
}
