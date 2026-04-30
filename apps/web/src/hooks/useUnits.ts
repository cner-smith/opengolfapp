import { useProfile } from './useProfile'

export type DistanceUnit = 'yards' | 'meters'

export function useUnits() {
  const { data: profile } = useProfile()
  const unit: DistanceUnit = profile?.distance_unit ?? 'yards'

  function toDisplay(yards: number, decimals = 0): string {
    if (!Number.isFinite(yards)) return '—'
    if (unit === 'meters') {
      return (yards * 0.9144).toFixed(decimals) + ' m'
    }
    return yards.toFixed(decimals) + ' yd'
  }

  // Putt distances: feet for yards-mode (golf convention), metres otherwise.
  function toDisplayFt(feet: number, decimals = 1): string {
    if (!Number.isFinite(feet)) return '—'
    if (unit === 'meters') {
      return (feet * 0.3048).toFixed(decimals) + ' m'
    }
    return Math.round(feet) + ' ft'
  }

  return { unit, toDisplay, toDisplayFt }
}
