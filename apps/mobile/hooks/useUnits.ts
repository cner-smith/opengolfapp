import { useEffect, useState } from 'react'
import { YARDS_TO_METERS, type DistanceUnit } from '@oga/core'
import { getProfile } from '@oga/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type { DistanceUnit }

// Mobile mirror of the web useUnits hook. Reads the profile's
// distance_unit lazily — components can render with the default 'yards'
// formatting while the value loads.
export function useUnits() {
  const { user } = useAuth()
  const [unit, setUnit] = useState<DistanceUnit>('yards')

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[useUnits/getProfile]', error.message)
        return
      }
      if (!data) return
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
      return (yards * YARDS_TO_METERS).toFixed(decimals) + ' m'
    }
    return yards.toFixed(decimals) + ' yd'
  }

  // Putt distances render in cm under metric mode — most metric
  // golfers still call putt distance in centimetres even when other
  // distances are metres. Feet under yards mode.
  function toDisplayFt(feet: number, _decimals = 1): string {
    if (!Number.isFinite(feet)) return '—'
    if (unit === 'meters') {
      return Math.round(feet * 30.48) + ' cm'
    }
    return Math.round(feet) + ' ft'
  }

  return { unit, toDisplay, toDisplayFt }
}
