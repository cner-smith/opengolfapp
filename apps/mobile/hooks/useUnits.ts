import { useCallback, useMemo } from 'react'
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

  // Memoize the formatters (pure over `unit`) so their identity is stable
  // across renders. A fresh identity each render silently defeats downstream
  // memos that key on them — e.g. the map breadcrumb's segment GeoJSON
  // (BreadcrumbLayers) would re-serialize a Mapbox ShapeSource every render.
  const toDisplay = useCallback(
    (yards: number, decimals = 0) => formatDistance(yards, unit, decimals),
    [unit],
  )
  const toDisplayFt = useCallback(
    (feet: number) => formatPuttDistance(feet, unit),
    [unit],
  )

  return useMemo(
    () => ({ unit, toDisplay, toDisplayFt }),
    [unit, toDisplay, toDisplayFt],
  )
}
