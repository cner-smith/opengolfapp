import { describe, expect, it } from 'vitest'
import { clubChangeCallouts, clubHistory, type ClubHistoryRow } from './club-history'
import type { ShotShape } from './constants'

// Shots start on the equator and play due north. Distance shots (no aim)
// finish `yards` up the meridian under haversine's radius; aimed shots aim
// 150 yd north and finish `right`/`long` of the aim in the dispersion frame
// (121,000 yd per degree), so the hand-worked yards come straight back.
const HAVERSINE_YD_PER_DEG = (6371000 * 1.09361 * Math.PI) / 180
const DISP_YD_PER_DEG = 121_000
let seq = 0

function row(over: Partial<ClubHistoryRow> & { played?: string; round?: string } = {}): ClubHistoryRow {
  const { played = '2026-07-10', round = played, ...rest } = over
  return {
    id: `s${seq++}`,
    club: '7i',
    lie_type: null,
    start_lat: 0,
    start_lng: 0,
    end_lat: 150 / HAVERSINE_YD_PER_DEG,
    end_lng: 0,
    aim_lat: null,
    aim_lng: null,
    shape: null,
    hole_scores: { round_id: round, rounds: { played_at: played } },
    ...rest,
  }
}

const dist = (yards: number, o: Parameters<typeof row>[0] = {}) => row({ end_lat: yards / HAVERSINE_YD_PER_DEG, ...o })

function aimed(right: number, long: number, o: Parameters<typeof row>[0] = {}) {
  const aimLat = 150 / DISP_YD_PER_DEG
  return row({ aim_lat: aimLat, aim_lng: 0, end_lat: aimLat + long / DISP_YD_PER_DEG, end_lng: right / DISP_YD_PER_DEG, ...o })
}

describe('clubHistory', () => {
  it('buckets by the played date in local time, oldest first', () => {
    const periods = clubHistory(
      [
        dist(150, { played: '2026-07-01' }),
        dist(150, { played: '2026-06-30' }),
        // 03:00 UTC on 1 Aug is still 31 Jul in Chicago (vitest pins TZ).
        dist(150, { played: '2026-08-01T03:00:00Z' }),
      ],
      '7i',
      { period: 'month' },
    )
    expect(periods.map((p) => [p.label, p.distanceShots, p.from, p.to])).toEqual([
      ['Jun', 1, '2026-06-01', '2026-06-30'],
      ['Jul', 2, '2026-07-01', '2026-07-31'],
    ])
  })

  it('reads typical as the median and p16/p84 as the 1/6 and 5/6 quantiles; under 8 is thin', () => {
    const [p] = clubHistory([140, 170, 150, 145, 160, 152, 155].map((y) => dist(y)), '7i', { period: 'month' })
    // Sorted 140 145 150 152 155 160 170: median 152; rank 6·1/6 = 1 → 145; 6·5/6 = 5 → 160.
    expect(p!.typical).toBeCloseTo(152, 6)
    expect(p!.p16).toBeCloseTo(145, 6)
    expect(p!.p84).toBeCloseTo(160, 6)
    expect(p!.thin).toBe(true)
    const [eight] = clubHistory([140, 170, 150, 145, 160, 152, 155, 150].map((y) => dist(y)), '7i', { period: 'month' })
    expect(eight!.thin).toBe(false)
  })

  it('counts distance shots by the Club distances rule and only this club', () => {
    const [p] = clubHistory(
      [
        dist(150),
        dist(150, { lie_type: 'green' }),
        dist(2),
        dist(150, { end_lat: null }),
        dist(150, { club: '8i' }),
        dist(150, { hole_scores: null }),
      ],
      '7i',
      { period: 'month' },
    )
    expect(p!.distanceShots).toBe(1)
  })

  it('windows rounds back from the newest; years show when not the latest', () => {
    const days = ['2025-12-20', ...Array.from({ length: 11 }, (_, i) => `2026-03-${String(i + 10)}`)]
    const periods = clubHistory(
      days.map((d) => dist(150, { played: d, round: `r-${d}` })),
      '7i',
      { period: { rounds: 10 } },
    )
    expect(periods.map((p) => [p.label, p.distanceShots, p.from, p.to])).toEqual([
      ['Mar 10', 2, '2025-12-20', '2026-03-10'],
      ['Mar 20', 10, '2026-03-11', '2026-03-20'],
    ])
    const months = clubHistory([dist(150, { played: '2025-12-20' }), dist(150, { played: '2026-01-05' })], '7i', {
      period: 'month',
    })
    expect(months.map((p) => p.label)).toEqual(['Dec 2025', 'Jan'])
  })

  it('takes the ring and average miss from the aimed shots', () => {
    // Laterals ±10 around 4 (population σ 10), all 2 yd short.
    const shots = [...Array(5)].flatMap(() => [aimed(14, -2), aimed(-6, -2)])
    const [p] = clubHistory([...shots, dist(150)], '7i', { period: 'month' })
    expect(p!.aimedShots).toBe(10)
    expect(p!.distanceShots).toBe(11)
    expect(p!.ring!.width).toBeCloseTo(2 * 1.5096 * 10, 1)
    expect(p!.ring!.depth).toBeCloseTo(0, 1)
    expect(p!.avgMiss!.lateral).toBeCloseTo(4, 1)
    expect(p!.avgMiss!.distance).toBeCloseTo(-2, 1)
    expect(p!.ringThin).toBe(false)
  })

  it('folds hook into draw and slice into fade', () => {
    const shapes: ShotShape[] = ['hook', 'draw', 'draw', 'straight', 'fade', 'slice', 'slice']
    const [p] = clubHistory(shapes.map((shape) => aimed(0, 0, { shape })), '7i', { period: 'month' })
    expect(p!.shape).toEqual({ draw: 3, straight: 1, fade: 3 })
  })
})

const month = (m: string, shots: ClubHistoryRow[]) => shots.map((s) => ({ ...s, hole_scores: { round_id: m, rounds: { played_at: `2026-${m}-15` } } }))
const spread = (centre: number, half: number[]) => [...half, ...half].map((d) => dist(centre + d))
const opts = { club: '7i', unit: 'yards' as const }

describe('clubChangeCallouts', () => {
  it('says a distance change past 2·SE and 3 yd', () => {
    // 149 ± (0, 2, 4) twice: s² = 80/9; SE = √(2·8.89/10) = 1.33, so 2·SE = 2.7 < 6.
    const periods = clubHistory(
      [...month('07', spread(149, [-4, -2, 0, 2, 4])), ...month('10', spread(155, [-4, -2, 0, 2, 4]))],
      '7i',
      { period: 'month' },
    )
    const c = clubChangeCallouts(periods, opts)
    expect(c.sentences).toEqual(['Your 7-iron goes 6 yd farther than in Jul.'])
    expect([c.first?.label, c.last?.label]).toEqual(['Jul', 'Oct'])
    expect(clubChangeCallouts(periods, { club: '7i', unit: 'meters' }).sentences).toEqual([
      'Your 7-iron goes 5 m farther than in Jul.',
    ])
  })

  it('stays quiet under 3 yd, inside the noise, or under 10 shots', () => {
    const half = [-4, -2, 0, 2, 4]
    const small = clubHistory([...month('07', spread(149, half)), ...month('10', spread(151, half))], '7i', { period: 'month' })
    expect(clubChangeCallouts(small, opts).sentences).toEqual([])
    // ±(0, 10, 20): s² = 2000/9, 2·SE = 13.3 > 6.
    const wide = [-20, -10, 0, 10, 20]
    const noisy = clubHistory([...month('07', spread(149, wide)), ...month('10', spread(155, wide))], '7i', { period: 'month' })
    expect(clubChangeCallouts(noisy, opts).sentences).toEqual([])
    const few = clubHistory(
      [...month('07', spread(149, half).slice(0, 9)), ...month('10', spread(165, half))],
      '7i',
      { period: 'month' },
    )
    expect(clubChangeCallouts(few, opts)).toEqual({ sentences: [], first: null, last: null })
  })

  it('says a narrower ring when the width change beats its noise', () => {
    // Widths 2·1.5096·15 = 45.3 and 2·1.5096·5 = 15.1; SE 45.3/√18 and 15.1/√18 → 2·SE = 22.5 < 30.2.
    const ring = (h: number) => [...Array(5)].flatMap(() => [aimed(h, 0), aimed(-h, 0)])
    const periods = clubHistory([...month('07', ring(15)), ...month('10', ring(5))], '7i', { period: 'month' })
    expect(clubChangeCallouts(periods, opts).sentences).toEqual(["Your 7-iron's ring is 30 yd narrower than in Jul."])
  })

  it('says the miss when its side flips', () => {
    // 8 ± 3 right: SE = 3/√9 = 1, so the average is past 2·SE; then 8 ± 3 left.
    const side = (c: number) => [...Array(5)].flatMap(() => [aimed(c + 3, 0), aimed(c - 3, 0)])
    const periods = clubHistory([...month('07', side(8)), ...month('10', side(-8))], '7i', { period: 'month' })
    expect(clubChangeCallouts(periods, opts).sentences).toEqual([
      'Your miss has moved from right to left of your aim since Jul.',
    ])
    const same = clubHistory([...month('07', side(8)), ...month('10', side(7))], '7i', { period: 'month' })
    expect(clubChangeCallouts(same, opts).sentences).toEqual([])
  })
})
