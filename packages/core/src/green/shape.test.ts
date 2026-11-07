import { describe, expect, it } from 'vitest'
import { gridOf } from './__fixtures__/grids'
import { decodeGreenGrid, encodeGreenGrid, type GreenGrid } from './codec'
import { greenShape, shapePhrase, type GreenShape } from './shape'
import fixture from './__fixtures__/green-way-289147011.json'

// 41×41 cells: x 0–20 m east, y 0 to −20 m north of cell (0,0), centre (10, −10).
// The collar takes 2 cells a side, so the interior runs 9 m either side of the centre.
const N = 41
const circle = (x: number, y: number) => (x - 10) ** 2 + (y + 10) ** 2 <= 100

/** A high or low spot with the rim's drop (or rise) given per edge, approach north. */
function spotShape(kind: 'high' | 'low', bearingDeg: number, middle: boolean, edges: { back: number; right: number; front: number; left: number }): GreenShape {
  // 10° bins from north; each edge owns the bins whose centres sit within 45° of it.
  const rimCm = Array.from({ length: 36 }, (_, i) => {
    const b = i * 10 + 5
    return b < 45 || b > 315 ? edges.back : b < 135 ? edges.right : b < 225 ? edges.front : edges.left
  })
  return { kind, spot: { bearingDeg, middle }, rimCm }
}

describe('shapePhrase', () => {
  // Heights stay in whole inches or whole centimetres: 84 / 2.54 = 33.07 in.
  it.each([
    ['yards', 'Two tiers · the upper tier is 33 in higher'],
    ['meters', 'Two tiers · the upper tier is 84 cm higher'],
  ] as const)('words a tier step in %s', (unit, words) => {
    expect(shapePhrase({ kind: 'two-tiers', stepCm: 84, atM: 9 }, 0, unit)).toBe(words)
  })

  it('says nothing for a plain tilt: line 1 already says it', () => {
    expect(shapePhrase({ kind: 'plain' }, 0, 'yards')).toBeNull()
  })

  it('names the high spot and the edges at least 10 cm and half the biggest drop below it', () => {
    // Biggest drop 40 cm: the front (40) and the right (25) count; the left (15) is under 20; the back (2) under 10.
    const s = spotShape('high', 315, false, { back: 2, right: 25, front: 40, left: 15 })
    expect(shapePhrase(s, 0, 'yards')).toBe('High at the back left · falls to the front and right')
  })

  it('leaves out the edges the spot itself sits on', () => {
    // The back edge runs on to the back right, which is lower; it still isn't "away" from a back-left high.
    const s = spotShape('high', 315, false, { back: 30, right: 25, front: 40, left: 5 })
    expect(shapePhrase(s, 0, 'yards')).toBe('High at the back left · falls to the front and right')
  })

  it('turns the words with the approach', () => {
    // Coming from the north (approach 180): north is the front, east the left.
    const s = spotShape('high', 315, false, { back: 2, right: 25, front: 40, left: 15 })
    expect(shapePhrase(s, 180, 'yards')).toBe('High at the front right · falls to the back and left')
  })

  it('says "on" a side and lists three edges', () => {
    const s = spotShape('high', 270, false, { back: 30, right: 40, front: 35, left: 3 })
    expect(shapePhrase(s, 0, 'yards')).toBe('High on the left · falls to the front, back and right')
  })

  it('says every edge for a high in the middle with all four edges below it', () => {
    const s = spotShape('high', 90, true, { back: 20, right: 30, front: 40, left: 25 })
    expect(shapePhrase(s, 0, 'yards')).toBe('High in the middle · falls to every edge')
  })

  it('says nothing when the only fall is to the far edge: that is line 1', () => {
    const s = spotShape('high', 0, false, { back: 3, right: 12, front: 40, left: 15 })
    expect(shapePhrase(s, 0, 'yards')).toBeNull()
  })

  it('says nothing when no edge is 10 cm below the high', () => {
    const s = spotShape('high', 0, true, { back: 6, right: 9, front: 8, left: 5 })
    expect(shapePhrase(s, 0, 'yards')).toBeNull()
  })

  it('words a low spot by the edges that rise from it', () => {
    const s = spotShape('low', 0, true, { back: 20, right: 30, front: 40, left: 25 })
    expect(shapePhrase(s, 0, 'yards')).toBe('Low in the middle · rises to every edge')
  })

  it('says "through the middle" for a middle low that rises to two opposite edges only', () => {
    const s = spotShape('low', 0, true, { back: 4, right: 30, front: 6, left: 25 })
    expect(shapePhrase(s, 0, 'yards')).toBe('Low through the middle · rises to the left and right')
  })

  it('words a swale by the sides that rise either side of it', () => {
    expect(shapePhrase({ kind: 'swale', axisDeg: 0 }, 0, 'yards')).toBe('Low through the middle · rises to the left and right')
    expect(shapePhrase({ kind: 'swale', axisDeg: 0 }, 90, 'yards')).toBe('Low through the middle · rises to the front and back')
    expect(shapePhrase({ kind: 'swale', axisDeg: 45 }, 0, 'yards')).toBe('Low through the middle · rises to the front right and back left')
  })

  it('says nothing for a saddle', () => {
    expect(shapePhrase({ kind: 'mixed' }, 0, 'yards')).toBeNull()
  })
})

describe('greenShape', () => {
  it('calls a 2% plane plain', () => {
    expect(greenShape(gridOf(N, N, (x) => 20 * x))).toEqual({ kind: 'plain' })
  })

  it('finds two tiers: a 2 m band at 16% between flat tiers, 32 cm apart', () => {
    // s = metres north of the south edge. Flat to s = 9, up 16% to s = 11, flat after.
    const tiered = (_: number, y: number) => {
      const s = y + 20
      return s < 9 ? 0 : s < 11 ? 160 * (s - 9) : 320
    }
    // The band's central differences reach 4% (the floor) in a shoulder bin, so the band reads 3 m: its middle sits 9.5 m in.
    const shape = greenShape(gridOf(N, N, tiered))!
    expect(shape).toEqual({ kind: 'two-tiers', stepCm: 32, atM: 9.5 })
    // 32 / 2.54 = 12.6 in.
    expect(shapePhrase(shape, 0, 'yards')).toBe('Two tiers · the upper tier is 13 in higher')
  })

  it('leaves a 16 cm step out of the two tiers: under 30 cm reads as a plain tilt', () => {
    const tiered = (_: number, y: number) => {
      const s = y + 20
      return s < 9 ? 0 : s < 11 ? 80 * (s - 9) : 160
    }
    expect(greenShape(gridOf(N, N, tiered))).toEqual({ kind: 'plain' })
  })

  it('finds a crown in the middle that falls to every edge', () => {
    // z = −0.005 r² m: the rim (r ≈ 8.5–9 m) sits ~40 cm below the top all round.
    const shape = greenShape(gridOf(N, N, (x, y) => -5 * ((x - 10) ** 2 + (y + 10) ** 2), circle))!
    expect(shape.kind).toBe('high')
    expect(shapePhrase(shape, 0, 'yards')).toBe('High in the middle · falls to every edge')
  })

  it('finds a crown shifted to the back right and the edges it falls to', () => {
    // Top 3 m east and 3 m north of the centre. Rim drops, approach north: back and right ~22 cm,
    // front and left ~77 cm, so only the front and left are over half the biggest.
    const shape = greenShape(gridOf(N, N, (x, y) => -5 * ((x - 13) ** 2 + (y + 7) ** 2), circle))!
    expect(shape.kind).toBe('high')
    expect(shapePhrase(shape, 0, 'yards')).toBe('High at the back right · falls to the front and left')
    expect(shapePhrase(shape, 180, 'yards')).toBe('High at the front left · falls to the back and right')
  })

  it('finds a bowl: low in the middle, rising to every edge', () => {
    const shape = greenShape(gridOf(N, N, (x, y) => 5 * ((x - 10) ** 2 + (y + 10) ** 2), circle))!
    expect(shape.kind).toBe('low')
    expect(shapePhrase(shape, 0, 'yards')).toBe('Low in the middle · rises to every edge')
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

  it('finds a swale running front to back', () => {
    const shape = greenShape(gridOf(N, N, (x) => 5 * (x - 10) ** 2))!
    expect(shape.kind).toBe('swale')
    expect(shapePhrase(shape, 0, 'yards')).toBe('Low through the middle · rises to the left and right')
  })

  it('finds a swale on a tilted green', () => {
    // The synthetic swale of the tagging page: 0.3 m across 10 m each side, plus 1.2% back to front.
    const shape = greenShape(gridOf(N, N, (x, y) => 3 * (x - 10) ** 2 - 12 * y, circle))!
    expect(shape.kind).toBe('swale')
  })

  it('calls a saddle mixed', () => {
    expect(greenShape(gridOf(N, N, (x, y) => 5 * ((x - 10) ** 2 - (y + 10) ** 2)))).toEqual({ kind: 'mixed' })
  })

  it('reads the real Oklahoma green from its high spot', () => {
    const { width, height, stepMm, zMinMm, q } = fixture
    const g: GreenGrid = {
      width,
      height,
      stepMm,
      zMinMm,
      mask: Uint8Array.from(q.flat(), (v) => (v === null ? 0 : 1)),
      heightsMm: Float64Array.from(q.flat(), (v) => (v === null ? NaN : zMinMm + stepMm * v)),
    }
    expect(greenShape(decodeGreenGrid(encodeGreenGrid(g)))!.kind).toBe('high')
  })

  it('gives no shape for a green under 200 interior cells', () => {
    expect(greenShape(gridOf(16, 16, (x) => 20 * x))).toBeNull()
  })
})
