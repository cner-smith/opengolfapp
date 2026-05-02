import { formatDistance, formatPuttDistance, type DistanceUnit } from '@oga/core'
import { useUnitsContext } from '../contexts/UnitsContext'

export type { DistanceUnit }

// Reads the current distance unit from UnitsProvider — no per-call DB
// fetch (see contexts/UnitsContext for the single shared fetch). Returns
// the same { unit, toDisplay, toDisplayFt } shape the component tree
// already depends on; formatters are imported from @oga/core so the
// conversion factors don't drift between web and mobile.
export interface UseUnitsResult {
  unit: DistanceUnit
  toDisplay: (yards: number, decimals?: number) => string
  toDisplayFt: (feet: number) => string
}

export function useUnits(): UseUnitsResult {
  const { unit } = useUnitsContext()

  function toDisplay(yards: number, decimals = 0): string {
    return formatDistance(yards, unit, decimals)
  }

  function toDisplayFt(feet: number): string {
    return formatPuttDistance(feet, unit)
  }

  return { unit, toDisplay, toDisplayFt }
}
