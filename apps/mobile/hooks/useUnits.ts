import { YARDS_TO_METERS, type DistanceUnit } from '@oga/core'
import { useUnitsContext } from '../contexts/UnitsContext'

export type { DistanceUnit }

// Reads the current distance unit from UnitsProvider — no per-call DB
// fetch (see contexts/UnitsContext for the single shared fetch). Returns
// the same { unit, toDisplay, toDisplayFt } shape the component tree
// already depends on.
export function useUnits() {
  const { unit } = useUnitsContext()

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
