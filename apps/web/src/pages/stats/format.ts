import { YARDS_TO_METERS, type ApproachBandStat, type DistanceUnit } from '@oga/core'

// Formatters — never return NaN/undefined to the DOM.

export function fmtNumber(v: number | null, digits: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

export function fmtInt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toString()
}

export function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(0)}%`
}

export function formatBandLabel(
  band: ApproachBandStat,
  unit: DistanceUnit,
  toDisplay: (yards: number, decimals?: number) => string,
): string {
  if (!Number.isFinite(band.maxYards)) {
    return `${toDisplay(band.minYards)}+`
  }
  // Show range as "min–max <unit>" by stripping the unit off the lower bound.
  const upper = toDisplay(band.maxYards)
  const lowerNumeric = unit === 'meters'
    ? (band.minYards * YARDS_TO_METERS).toFixed(0)
    : band.minYards.toFixed(0)
  return `${lowerNumeric}–${upper}`
}
