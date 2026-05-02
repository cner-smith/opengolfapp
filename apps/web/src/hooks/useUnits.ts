import { formatDistance, formatPuttDistance, type DistanceUnit } from '@oga/core'
import { useProfile } from './useProfile'

export type { DistanceUnit }

export interface UseUnitsResult {
  unit: DistanceUnit
  toDisplay: (yards: number, decimals?: number) => string
  toDisplayFt: (feet: number) => string
}

export function useUnits(): UseUnitsResult {
  const { data: profile } = useProfile()
  const unit: DistanceUnit = profile?.distance_unit ?? 'yards'

  function toDisplay(yards: number, decimals = 0): string {
    return formatDistance(yards, unit, decimals)
  }

  function toDisplayFt(feet: number): string {
    return formatPuttDistance(feet, unit)
  }

  return { unit, toDisplay, toDisplayFt }
}
