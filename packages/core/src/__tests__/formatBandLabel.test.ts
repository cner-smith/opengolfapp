import { describe, it, expect } from 'vitest'
import { formatBandLabel, type ApproachBandStat } from '../stats'
import { YARDS_TO_METERS } from '../units'

const yardsFmt = (y: number) => `${y.toFixed(0)} yd`
const metersFmt = (y: number) => `${(y * YARDS_TO_METERS).toFixed(0)} m`

const band = (minYards: number, maxYards: number): ApproachBandStat => ({
  key: 'b',
  label: '',
  minYards,
  maxYards,
  avgSg: null,
  shots: 0,
})

describe('formatBandLabel', () => {
  it('renders a finite range with the lower bound numeric-only and upper with unit', () => {
    expect(formatBandLabel(band(50, 100), 'yards', yardsFmt)).toBe('50–100 yd')
  })

  it('renders an open-ended (Infinity) range with the lower bound + plus sign', () => {
    expect(formatBandLabel(band(200, Infinity), 'yards', yardsFmt)).toBe('200 yd+')
  })

  it('converts the lower bound to meters when unit=meters', () => {
    expect(formatBandLabel(band(50, 100), 'meters', metersFmt)).toBe('46–91 m')
  })

  it('converts the open-ended lower bound via the toDisplay callback', () => {
    expect(formatBandLabel(band(200, Infinity), 'meters', metersFmt)).toBe('183 m+')
  })
})
