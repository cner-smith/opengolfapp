import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { DistanceUnit } from '@oga/core'
import { getProfile } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Single profile fetch for the whole app session. Previously every
// component instance that called useUnits ran its own getProfile —
// roughly 36 redundant fetches on a populated round screen. Lift it to
// one provider near the top of the app tree.

interface UnitsContextValue {
  unit: DistanceUnit
  isYards: boolean
  isMetres: boolean
}

const DEFAULT: UnitsContextValue = {
  unit: 'yards',
  isYards: true,
  isMetres: false,
}

const UnitsContext = createContext<UnitsContextValue>(DEFAULT)

export function UnitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unit, setUnit] = useState<DistanceUnit>('yards')

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[UnitsProvider/getProfile]', error.message)
        return
      }
      if (!data) return
      setUnit(data.distance_unit === 'meters' ? 'meters' : 'yards')
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const value: UnitsContextValue = {
    unit,
    isYards: unit === 'yards',
    isMetres: unit === 'meters',
  }
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
}

export function useUnitsContext(): UnitsContextValue {
  return useContext(UnitsContext)
}
