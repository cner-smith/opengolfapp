import { describe, expect, it } from 'vitest'
import { gridOf } from './__fixtures__/grids'
import { decodeGreenGrid, encodeGreenGrid, type GreenGrid } from './codec'
import { greenShape, shapePhrase } from './shape'
import fixture from './__fixtures__/green-way-289147011.json'

// 41×41 cells: x 0–20 m east, y 0 to −20 m north of cell (0,0), centre (10, −10).
// The collar takes 2 cells a side, so the interior runs 9 m either side of the centre.
const N = 41
const circle = (x: number, y: number) => (x - 10) ** 2 + (y + 10) ** 2 <= 100

describe('shapePhrase units', () => {
  // Heights stay in whole inches or whole centimetres: 84 / 2.54 = 33.07 in; 45.4 / 2.54 = 17.87 in.
  it.each([
    ['yards', 'Two tiers · the upper tier is 33 in higher'],
    ['meters', 'Two tiers · the upper tier is 84 cm higher'],
  ] as const)('words a tier step in %s', (unit, words) => {
    expect(shapePhrase({ kind: 'two-tiers', stepCm: 84, atM: 9 }, 0, unit)).toBe(words)
  })

  it.each([
    ['yards', 'Crown · high in the middle, falls 18 in to the edges'],
    ['meters', 'Crown · high in the middle, falls 45 cm to the edges'],
  ] as const)('words a crown in %s', (unit, words) => {
    expect(shapePhrase({ kind: 'crown', fallCm: 45.4 }, 0, unit)).toBe(words)
  })

  it('has no unit in the planar or ridge phrases', () => {
    const planar = { kind: 'planar', tiltPct: 2, downhillDeg: 180 } as const
    expect(shapePhrase(planar, 0, 'meters')).toBe(shapePhrase(planar, 0, 'yards'))
    expect(shapePhrase(planar, 0, 'meters')).toBe('Back to front · Moderate')
  })
})

describe('greenShape', () => {
  it('calls a 2% plane planar and words it from the approach', () => {
    const s = greenShape(gridOf(N, N, (x) => 20 * x))!
    expect(s.kind).toBe('planar')
    if (s.kind !== 'planar') return
    expect(s.tiltPct).toBeCloseTo(2, 9)
    expect(s.downhillDeg).toBeCloseTo(270, 9)
    expect(shapePhrase(s, 90, 'yards')).toBe('Back to front · Moderate')
  })

  it('finds two tiers: a 2 m band at 8% between flat tiers, 16 cm apart', () => {
    // s = metres north of the south edge. Flat to s = 9, up 8% to s = 11, flat after.
    // 1 m bins along the fall line give 0 … 0, 20, 100, 160 … 160 mm; the 5% and 7% bins are the band.
    const tiered = (_: number, y: number) => {
      const s = y + 20
      return s < 9 ? 0 : s < 11 ? 80 * (s - 9) : 160
    }
    const shape = greenShape(gridOf(N, N, tiered))!
    expect(shape).toEqual({ kind: 'two-tiers', stepCm: 16, atM: 9 })
    // 16 / 2.54 = 6.3 in.
    expect(shapePhrase(shape, 0, 'yards')).toBe('Two tiers · the upper tier is 6 in higher')
    expect(shapePhrase(shape, 0, 'meters')).toBe('Two tiers · the upper tier is 16 cm higher')
  })

  it('finds a crown and measures its fall from the top to the collar', () => {
    // z = −0.005 r² m. The top is 0; the collar ring sits at r ≈ 9–10 m, median ≈ 9.5 m → −45 cm.
    const shape = greenShape(gridOf(N, N, (x, y) => -5 * ((x - 10) ** 2 + (y + 10) ** 2), circle))!
    expect(shape.kind).toBe('crown')
    if (shape.kind !== 'crown') return
    expect(shape.fallCm).toBeGreaterThan(44)
    expect(shape.fallCm).toBeLessThan(47)
    expect(shapePhrase(shape, 0, 'yards')).toBe('Crown · high in the middle, falls 18 in to the edges')
  })

  it('finds a ridge and turns its line with the approach', () => {
    const shape = greenShape(gridOf(N, N, (x) => -5 * (x - 10) ** 2))!
    expect(shape.kind).toBe('ridge')
    if (shape.kind !== 'ridge') return
    expect(shape.axisDeg).toBeCloseTo(0, 9)
    expect(shapePhrase(shape, 0, 'yards')).toBe('Ridge · runs front to back, falls off both sides')
    expect(shapePhrase(shape, 90, 'yards')).toBe('Ridge · runs left to right, falls off both sides')
    expect(shapePhrase(shape, 45, 'yards')).toBe('Ridge · runs front right to back left, falls off both sides')
  })

  it('finds a slanted ridge along its spine', () => {
    // The spine runs through the centre at a bearing of 30°: along (sin 30°, cos 30°), so the
    // height falls off with the distance across it, (x, y)·(cos 30°, −sin 30°).
    const across = (x: number, y: number) => (x - 10) * Math.cos(Math.PI / 6) - (y + 10) * Math.sin(Math.PI / 6)
    const shape = greenShape(gridOf(N, N, (x, y) => -5 * across(x, y) ** 2))!
    expect(shape.kind).toBe('ridge')
    if (shape.kind !== 'ridge') return
    expect(shape.axisDeg).toBeCloseTo(30, 9)
    expect(shapePhrase(shape, 0, 'yards')).toBe('Ridge · runs front left to back right, falls off both sides')
  })

  it('says no single slope for a saddle (not in v1) and gives the rise', () => {
    // ±0.005·9² m at the interior's edges: 81 cm from lowest to highest.
    const shape = greenShape(gridOf(N, N, (x, y) => 5 * ((x - 10) ** 2 - (y + 10) ** 2)))!
    expect(shape).toEqual({ kind: 'no-single-slope', riseCm: expect.closeTo(81, 9) })
    // 81 / 2.54 = 31.9 in.
    expect(shapePhrase(shape, 0, 'yards')).toBe('No single slope · 32 in from the lowest to the highest point')
    expect(shapePhrase(shape, 0, 'meters')).toBe('No single slope · 81 cm from the lowest to the highest point')
  })

  it('says no single slope for a bowl (not in v1)', () => {
    expect(greenShape(gridOf(N, N, (x, y) => 5 * ((x - 10) ** 2 + (y + 10) ** 2), circle))!.kind).toBe('no-single-slope')
  })

  it('reads the real Oklahoma green as no single slope, as the research rule did', () => {
    const { width, height, stepMm, zMinMm, q } = fixture
    const g: GreenGrid = {
      width,
      height,
      stepMm,
      zMinMm,
      mask: Uint8Array.from(q.flat(), (v) => (v === null ? 0 : 1)),
      heightsMm: Float64Array.from(q.flat(), (v) => (v === null ? NaN : zMinMm + stepMm * v)),
    }
    expect(greenShape(decodeGreenGrid(encodeGreenGrid(g)))!.kind).toBe('no-single-slope')
  })

  it('gives no shape for a green under 200 interior cells', () => {
    expect(greenShape(gridOf(16, 16, (x) => 20 * x))).toBeNull()
  })
})
