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
  /** Profile calls this after a successful save; the provider only fetches
   *  once per sign-in, so without it a unit change needed an app restart. */
  setUnit: (u: DistanceUnit) => void
  /** Profile "Plays": the result pickers mirror shape / start for a lefty.
   *  Lives here because this is the app's one profile fetch. */
  playsLeftHanded: boolean
  setPlaysLeftHanded: (v: boolean) => void
}

const DEFAULT: UnitsContextValue = {
  unit: 'yards',
  isYards: true,
  isMetres: false,
  setUnit: () => {},
  playsLeftHanded: false,
  setPlaysLeftHanded: () => {},
}

const UnitsContext = createContext<UnitsContextValue>(DEFAULT)

export function UnitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unit, setUnit] = useState<DistanceUnit>('yards')
  const [playsLeftHanded, setPlaysLeftHanded] = useState(false)

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
      setPlaysLeftHanded(data.plays_left_handed === true)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const value: UnitsContextValue = {
    unit,
    isYards: unit === 'yards',
    isMetres: unit === 'meters',
    setUnit,
    playsLeftHanded,
    setPlaysLeftHanded,
  }
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
}

export function useUnitsContext(): UnitsContextValue {
  return useContext(UnitsContext)
}
