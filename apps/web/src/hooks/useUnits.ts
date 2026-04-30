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

  // Putt distances render in feet under yards mode (US golf convention)
  // and in centimetres under metres mode — golfers in metric countries
  // still call putts in cm even when other distances are metres.
  function toDisplayFt(feet: number, _decimals = 1): string {
    if (!Number.isFinite(feet)) return '—'
    if (unit === 'meters') {
      return Math.round(feet * 30.48) + ' cm'
    }
    return Math.round(feet) + ' ft'
  }

  return { unit, toDisplay, toDisplayFt }
}
