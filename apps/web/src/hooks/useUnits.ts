import { useCallback } from 'react'
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

  const toDisplay = useCallback(
    (yards: number, decimals = 0): string => formatDistance(yards, unit, decimals),
    [unit],
  )
  const toDisplayFt = useCallback(
    (feet: number): string => formatPuttDistance(feet, unit),
    [unit],
  )

  return { unit, toDisplay, toDisplayFt }
}
