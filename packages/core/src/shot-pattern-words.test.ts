import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  capFirst,
  categoriesFor,
  categoryOf,
  conflictWords,
  countWord,
  distanceText,
  distanceUnitAbbr,
  findingLine,
  mostlyTeeShots,
  readQuality,
  recordedNote,
  shortDate,
  shotParts,
  shotWords,
  tallyWords,
  wholeDistance,
  type ShotExtras,
} from './shot-pattern-words'
import { SHOT_SHAPE_LABELS, SHOT_START_LINE_LABELS } from './constants'
import { computeDispersionStats, shapeTally, startLineTally, type DispersionPoint } from './shot-patterns'

// Every expected sentence below is worked by hand from the points: averages,
// population SDs, the 2·SE + 2 yd rule in aimAdvice, and missLean's 70%.

let seq = 0
function pt(lat: number, along: number, over: Partial<DispersionPoint> = {}): DispersionPoint {
  return { id: `p${seq++}`, lateralOffsetYards: lat, distanceOffsetYards: along, ...over }
}
const alternate = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (i % 2 ? b : a))
function pattern(lats: number[], alongs: number[], over: Partial<DispersionPoint> = {}) {
  const points = lats.map((l, i) => pt(l, alongs[i]!, over))
  return { points, stats: computeDispersionStats(points)! }
}
// 7 at 2 short, 3 at 6 long: average 0.4 long (inside the 2 yd floor), and
// 70% short, so missLean says short.
const LEAN_SHORT = [-2, -2, -2, -2, -2, -2, -2, 6, 6, 6]

describe('findingLine', () => {
  it('centred, but most finish short: says so and keeps the aim', () => {
    const { points, stats } = pattern(alternate(10, -3, 3), LEAN_SHORT)
    expect(findingLine(stats, points, '7i', 'yards', false)).toBe(
      'Your 7-iron finishes centred on your aim, though most finish a little short. That’s inside the spread; keep your aim.',
    )
  })

  it('centred on both axes, deeper than wide: misses more by distance', () => {
    // SD 3 across, 4 along: 4 > 1.25 × 3.
    const { points, stats } = pattern(alternate(10, -3, 3), alternate(10, -4, 4))
    expect(findingLine(stats, points, '7i', 'yards', false)).toBe(
      'Your 7-iron finishes centred on your aim, and misses more by distance than by line. That’s inside the spread; keep your aim.',
    )
  })

  it('centred on both axes, as deep as wide: no distance clause', () => {
    const { points, stats } = pattern(alternate(10, -3, 3), alternate(10, 3, -3))
    expect(findingLine(stats, points, '8i', 'yards', false)).toBe(
      'Your 8-iron finishes centred on your aim. That’s inside the spread; keep your aim.',
    )
  })

  it('one axis advised, the other leaning: names both, fixes only the advised one', () => {
    // 9 / 11 right: average 10, SD 1, SE 1/3, so 10 yd right is beyond noise.
    const { points, stats } = pattern(alternate(10, 9, 11), LEAN_SHORT)
    expect(findingLine(stats, points, '7i', 'yards', false)).toBe(
      'Your 7-iron finishes about 10 yd right, though most finish a little short. Aim about 10 yd left.',
    )
  })

  it('both axes advised: aim and club', () => {
    const { points, stats } = pattern(alternate(10, 4, 6), alternate(10, -3, -5))
    expect(findingLine(stats, points, '7i', 'yards', false)).toBe(
      'Your 7-iron finishes about 4 yd short and 5 yd right. Aim about 5 yd left and take a little more club.',
    )
    expect(findingLine(stats, points, '7i', 'meters', false)).toBe(
      'Your 7-iron finishes about 4 m short and 5 m right. Aim about 5 m left and take a little more club.',
    )
  })

  it('a distance miss alone, level across', () => {
    const { points, stats } = pattern(alternate(10, -3, 3), alternate(10, 7, 9))
    expect(findingLine(stats, points, 'pw', 'yards', false)).toBe(
      'Your pitching wedge finishes about 8 yd long. Take a little less club.',
    )
  })

  it('tee club: width only, centred', () => {
    // ±10 across: SD 10, 68% half-width 15.096, so 30 yd side to side.
    const { points, stats } = pattern(alternate(10, -10, 10), alternate(10, -30, 30), { lieType: 'tee' })
    expect(findingLine(stats, points, 'driver', 'yards', true)).toBe(
      'Two in three of your driver shots finish inside 30 yd side to side, centred on your aim. That’s inside the spread; keep your aim.',
    )
  })

  it('tee club: centred but most finish right', () => {
    // 8 at 5 right, 2 at 20 left: average 0, SD 10 (30 yd wide), 80% right.
    const lats = [5, 5, 5, 5, 5, 5, 5, 5, -20, -20]
    const { points, stats } = pattern(lats, alternate(10, -30, 30), { lieType: 'tee' })
    expect(findingLine(stats, points, 'driver', 'yards', true)).toBe(
      'Two in three of your driver shots finish inside 30 yd side to side, centred on your aim, though most finish right. That’s inside the spread; keep your aim.',
    )
  })

  it('tee club: a side miss moves the aim', () => {
    const { points, stats } = pattern(alternate(10, -7, -9), alternate(10, -30, 30), { lieType: 'tee' })
    expect(findingLine(stats, points, '3w', 'yards', true)).toBe(
      'Two in three of your 3-wood shots finish inside 3 yd side to side, centred about 8 yd left of your aim. Aim about 8 yd right.',
    )
  })
})

describe('mostlyTeeShots', () => {
  it('needs more than half from the tee', () => {
    expect(mostlyTeeShots([pt(0, 0, { lieType: 'tee' }), pt(0, 0, { lieType: 'tee' }), pt(0, 0)])).toBe(true)
    expect(mostlyTeeShots([pt(0, 0, { lieType: 'tee' }), pt(0, 0, { lieType: 'fairway' })])).toBe(false)
  })
})

describe('readQuality', () => {
  it('early under 10, fair under 30, solid from 30', () => {
    expect([9, 10, 29, 30].map(readQuality)).toEqual(['an early read', 'a fair read', 'a fair read', 'a solid read'])
  })
})

describe('distance words', () => {
  it('whole units, no sign', () => {
    expect(wholeDistance(-4.6, 'yards')).toBe(5)
    expect(distanceText(10, 'meters')).toBe('9 m')
    expect(distanceText(-12.4, 'yards')).toBe('12 yd')
  })
})

describe('tallyWords', () => {
  const shapes = (...s: (DispersionPoint['shape'])[]) => s.map((shape) => pt(0, 0, { shape }))

  it('nothing recorded', () => {
    const points = shapes(null, null, null, null, null, null, null, null)
    expect(tallyWords(shapeTally(points, false), SHOT_SHAPE_LABELS, 8)).toEqual({ value: '—', note: 'Not recorded on any of these 8 shots yet' })
  })

  it('under five recorded', () => {
    const points = shapes('draw', 'draw', 'fade', null, null, null, null, null)
    expect(tallyWords(shapeTally(points, false), SHOT_SHAPE_LABELS, 8)).toEqual({ value: '—', note: 'Recorded on 3 of 8; five needed' })
  })

  it('mostly one, plural', () => {
    const points = shapes('draw', 'draw', 'draw', 'draw', 'draw', 'fade', 'fade')
    expect(tallyWords(shapeTally(points, false), SHOT_SHAPE_LABELS, 9).value).toBe('Mostly draws')
  })

  it('all one, invariant word', () => {
    const points = shapes('straight', 'straight', 'straight', 'straight', 'straight')
    expect(tallyWords(shapeTally(points, false), SHOT_SHAPE_LABELS, 5)).toEqual({ value: 'Straight', note: 'Recorded on 5 of 5' })
  })

  it('all pushes', () => {
    const points = ['push', 'push', 'push', 'push', 'push'].map((startLine) => pt(0, 0, { startLine: startLine as 'push' }))
    expect(tallyWords(startLineTally(points, false), SHOT_START_LINE_LABELS, 5).value).toBe('Pushes')
  })

  it('left-handed: a fade and a slice curve left', () => {
    // 2 fades, 2 slices, 2 draws: no value holds half, so mixed; for a
    // left-hander fades and slices go left (4) against the draws (2).
    const points = shapes('fade', 'fade', 'slice', 'slice', 'draw', 'draw')
    expect(tallyWords(shapeTally(points, true), SHOT_SHAPE_LABELS, 6).value).toBe('Mixed, leans left')
    expect(tallyWords(shapeTally(points, false), SHOT_SHAPE_LABELS, 6).value).toBe('Mixed, leans right')
  })
})

describe('shot readout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const extras: ShotExtras = { contact: 'solid', hole: 7, roundId: 'r1', course: 'Pine Valley' }

  it('everything recorded', () => {
    const p = pt(6.6, -4.4, { shape: 'draw', startLine: 'push', lieType: 'fairway', playedAt: '2025-03-09' })
    expect(shotParts(p, extras, 'yards', 'agree')).toEqual({
      where: '4 yd short, 7 yd right',
      recorded: 'Draw · push · solid · from the fairway',
      flag: null,
      when: 'Hole 7 · Mar 9, 2025 · Pine Valley',
    })
  })

  it('no shape recorded', () => {
    const p = pt(0.4, 0.6, { playedAt: '2026-10-12T00:00:00Z' })
    expect(shotWords(p, undefined, 'yards', 'none')).toEqual([
      'Level with the aim, on line',
      'Nothing recorded',
      'Shape and start line not recorded',
      'Oct 12',
    ])
  })

  it('a conflict is flagged over what is missing', () => {
    const p = pt(-12, 2, { shape: 'fade', startLine: 'pull' })
    expect(shotParts(p, undefined, 'yards', 'conflict').flag).toBe('A fade from a pull can’t finish here: check this shot')
    expect(conflictWords(pt(30, 0, { startLine: 'on_line' }))).toBe('It finished too far off its recorded start line: check this shot')
    expect(conflictWords(pt(30, 0, { shape: 'hook' }))).toBe('It finished too far off its recorded shape: check this shot')
  })

  it('shortDate drops this year and rejects junk', () => {
    expect(shortDate('2026-01-05')).toBe('Jan 5')
    expect(shortDate('2024-12-31T23:00:00-06:00')).toBe('Dec 31, 2024')
    expect(shortDate('soon')).toBeNull()
  })
})

describe('shot groups', () => {
  it('screen order, mirrored for a left-hander', () => {
    expect(categoriesFor('shape', false).map((c) => c.key)).toEqual(['hook', 'draw', 'straight', 'fade', 'slice'])
    expect(categoriesFor('shape', true).map((c) => c.key)).toEqual(['slice', 'fade', 'straight', 'draw', 'hook'])
    expect(categoriesFor('start', true).map((c) => c.label)).toEqual(['Push', 'On line', 'Pull'])
    expect(categoriesFor('contact', true).map((c) => c.key)).toEqual(['solid', 'fat', 'thin', 'topped', 'shank'])
    expect(categoriesFor('none', false)).toEqual([])
  })

  it('categoryOf reads the axis, contact from the extras', () => {
    const p = pt(0, 0, { shape: 'fade' })
    expect(categoryOf(p, undefined, 'shape')).toBe('fade')
    expect(categoryOf(p, undefined, 'start')).toBe('none')
    expect(categoryOf(p, { contact: 'thin', hole: null, roundId: null, course: null }, 'contact')).toBe('thin')
  })

  it('countWord plurals', () => {
    expect([countWord('draw', 'Draw', 3), countWord('push', 'Push', 2), countWord('straight', 'Straight', 2), countWord('fade', 'Fade', 1)]).toEqual([
      '3 draws',
      '2 pushes',
      '2 straight',
      '1 fade',
    ])
  })

  it('recordedNote counts what is recorded, or says how to record it', () => {
    const points = [pt(0, 0, { startLine: 'pull' }), pt(0, 0, { startLine: 'push' }), pt(0, 0)]
    expect(recordedNote('start', points, {}, '7-iron')).toEqual({ recorded: 2, note: 'Start line recorded on 2 of 3.' })
    expect(recordedNote('shape', points, {}, '7-iron')).toEqual({
      recorded: 0,
      note: 'No 7-iron shot here has its shape recorded yet. Set it in a shot’s result after the hole.',
    })
  })
})

describe('capFirst / distanceUnitAbbr', () => {
  it('capitalises only the first letter and leaves an empty string alone', () => {
    expect(capFirst('mostly draws')).toBe('Mostly draws')
    expect(capFirst('')).toBe('')
  })
  it('names the unit the player reads distances in', () => {
    expect(distanceUnitAbbr('yards')).toBe('yd')
    expect(distanceUnitAbbr('meters')).toBe('m')
  })
})
