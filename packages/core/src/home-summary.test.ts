import { describe, expect, it } from 'vitest'
import { homeSummary, type HomeSummaryRound } from './home-summary'

type R = HomeSummaryRound & { id: string }

const round = (id: string, played_at: string, o: Partial<R> = {}): R => ({
  id,
  played_at,
  total_score: null,
  sg_total: null,
  sg_off_tee: null,
  sg_approach: null,
  sg_around_green: null,
  sg_putting: null,
  hole_count: 18,
  hole_scores: [],
  ...o,
})

// 9 of 18 holes scored: ended early.
const partialHoles = Array.from({ length: 9 }, (_, i) => ({ score: 5, holes: { number: i + 1 } }))

describe('homeSummary', () => {
  // Newest first, as the queries return them.
  // A whole: total -2.0 = -0.5 tee, -1.0 approach, no around-green, -0.5 putting; score 92
  // B partial (9 of 18): kept out of every number
  // C whole, no SG at all (an imported round); score 88
  // D whole: +1.0 = 0.3 / 0.4 / none / 0.3; score 0 = "no score yet" sentinel
  // E whole: +0.6 = 0.1 / 0.2 / none / 0.3; score 80
  const rounds: R[] = [
    round('A', '2026-03-05', { total_score: 92, sg_total: -2, sg_off_tee: -0.5, sg_approach: -1, sg_putting: -0.5 }),
    round('B', '2026-03-04', { total_score: 45, sg_total: -9, sg_off_tee: -9, sg_approach: -9, sg_around_green: -9, sg_putting: -9, hole_scores: partialHoles }),
    round('C', '2026-03-03', { total_score: 88 }),
    round('D', '2026-03-02', { total_score: 0, sg_total: 1, sg_off_tee: 0.3, sg_approach: 0.4, sg_putting: 0.3 }),
    round('E', '2026-03-01', { total_score: 80, sg_total: 0.6, sg_off_tee: 0.1, sg_approach: 0.2, sg_putting: 0.3 }),
  ]
  const s = homeSummary(rounds)

  it('reads the whole rounds only, newest first', () => {
    expect(s.whole.map((r) => r.id)).toEqual(['A', 'C', 'D', 'E'])
  })

  it('averages each category over the rounds that have it (Q3)', () => {
    // tee      (-0.5 + 0.3 + 0.1) / 3 = -0.0333 → -0.03
    // approach (-1.0 + 0.4 + 0.2) / 3 = -0.1333 → -0.13
    // around   no round has it          → null (not 0)
    // putting  (-0.5 + 0.3 + 0.3) / 3 =  0.0333 →  0.03
    expect(s.areas).toEqual([
      { key: 'sg_off_tee', label: 'Off the tee', value: -0.03 },
      { key: 'sg_approach', label: 'Approach', value: -0.13 },
      { key: 'sg_around_green', label: 'Around the green', value: null },
      { key: 'sg_putting', label: 'Putting', value: 0.03 },
    ])
    // -0.03 - 0.13 + 0.03 = -0.13; the bar scale's peak is |-0.13|
    expect(s.totalSG).toBeCloseTo(-0.13, 10)
    expect(s.maxAbs).toBeCloseTo(0.13, 10)
  })

  it('averages real scores only: (92 + 88 + 80) / 3', () => {
    expect(s.avgScore).toBeCloseTo(260 / 3, 10)
  })

  it('trends total SG oldest to newest; a round with no SG is not a point', () => {
    expect(s.trend).toEqual([
      { date: '2026-03-01', sg: 0.6 },
      { date: '2026-03-02', sg: 1 },
      { date: '2026-03-05', sg: -2 },
    ])
  })

  it('finds the leak among the counted categories', () => {
    // weakest approach -0.13 (≤ -0.05 → costs 0.1); strongest putting 0.03 (< 0.05 → no clause)
    expect(s.finding).toBe('Approach costs you 0.1 strokes a round.')
  })

  it('a category no round has is not ranked as 0', () => {
    // tee/approach/putting all gain; around-green missing is left out of
    // the ranking (approach 0.2 is the weakest counted area).
    const r = [round('A', '2026-03-01', { sg_total: 0.9, sg_off_tee: 0.3, sg_approach: 0.2, sg_putting: 0.4 })]
    expect(homeSummary(r).finding).toBe('Every part of your game is gaining strokes; putting leads at 0.4 a round.')
    // three costing, one missing: the missing one has no bar value, not 0
    const neg = [round('A', '2026-03-01', { sg_total: -1.2, sg_off_tee: -0.3, sg_approach: -0.6, sg_putting: -0.3 })]
    expect(homeSummary(neg).areas.map((a) => a.value)).toEqual([-0.3, -0.6, null, -0.3])
  })

  it('whole rounds with no SG at all: no averages, no finding, no trend', () => {
    const r = homeSummary([round('C', '2026-03-03', { total_score: 88 })])
    expect(r.whole).toHaveLength(1)
    expect(r.areas.map((a) => a.value)).toEqual([null, null, null, null])
    expect(r.finding).toBeNull()
    expect(r.trend).toEqual([])
    expect(r.totalSG).toBeNull()
    expect(r.avgScore).toBe(88)
  })

  it('no rounds: empty and null', () => {
    const r = homeSummary([])
    expect(r.whole).toEqual([])
    expect(r.finding).toBeNull()
    expect(r.avgScore).toBeNull()
    expect(r.maxAbs).toBe(0)
  })

  it('the window is the newest 20 whole rounds; partials do not use a slot', () => {
    const many = Array.from({ length: 22 }, (_, i) =>
      round(`w${i}`, `2026-01-${String(28 - i).padStart(2, '0')}`, { sg_total: 0 }),
    )
    many.splice(3, 0, round('p', '2026-01-25', { hole_scores: partialHoles }))
    const ids = homeSummary(many).whole.map((r) => r.id)
    expect(ids).toHaveLength(20)
    expect(ids[0]).toBe('w0')
    expect(ids[19]).toBe('w19')
    expect(ids).not.toContain('p')
  })
})
