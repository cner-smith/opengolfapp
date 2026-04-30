import { useEffect, useState } from 'react'
import { getProfile } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type DistanceUnit = 'yards' | 'meters'

// Mobile mirror of the web useUnits hook. Reads the profile's
// distance_unit lazily — components can render with the default 'yards'
// formatting while the value loads.
export function useUnits() {
  const { user } = useAuth()
  const [unit, setUnit] = useState<DistanceUnit>('yards')

  useEffect(() => {
    if (!user) return
    let active = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getProfile(supabase, user.id).then(({ data }: { data: any }) => {
      if (!active || !data) return
      if (data.distance_unit === 'meters') setUnit('meters')
      else setUnit('yards')
    })
    return () => {
      active = false
    }
  }, [user?.id])

  function toDisplay(yards: number, decimals = 0): string {
    if (!Number.isFinite(yards)) return '—'
    if (unit === 'meters') {
      return (yards * 0.9144).toFixed(decimals) + ' m'
    }
    return yards.toFixed(decimals) + ' yd'
  }

  function toDisplayFt(feet: number, decimals = 1): string {
    if (!Number.isFinite(feet)) return '—'
    if (unit === 'meters') {
      return (feet * 0.3048).toFixed(decimals) + ' m'
    }
    return Math.round(feet) + ' ft'
  }

  return { unit, toDisplay, toDisplayFt }
}
