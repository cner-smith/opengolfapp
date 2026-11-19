import { describe, expect, it } from 'vitest'
import { shareCardModel, type ShareCardInput } from './share-card'

type HoleIn = ShareCardInput['holes'][number]
type Row = NonNullable<HoleIn['score']>

// Sam's DEV round f18bd31d (the mocks' data): [number, par, score, putts, fairway, gir, penalties, hole SG]
const RAW: [number, number, number, number, boolean | null, boolean, number, number][] = [
  [1, 4, 4, 1, true, false, 0, 1.05], [2, 3, 4, 2, null, false, 0, -0.06], [3, 4, 8, 2, false, false, 1, -2.52],
  [4, 5, 6, 2, true, false, 0, 0.03], [5, 4, 5, 2, true, false, 0, 0.07], [6, 4, 5, 3, true, true, 0, -0.06],
  [7, 5, 4, 1, false, true, 0, 1.86], [8, 3, 4, 2, null, false, 0, 0.25], [9, 4, 4, 2, true, true, 0, 1.27],
  [10, 4, 5, 2, false, false, 0, 0.27], [11, 4, 6, 2, true, false, 0, -0.69], [12, 3, 4, 2, null, false, 0, 0.15],
  [13, 5, 6, 2, false, false, 0, 0.01], [14, 3, 4, 2, null, false, 0, 0.01], [15, 4, 4, 1, false, false, 0, 1.23],
  [16, 4, 4, 1, false, false, 0, 1.1], [17, 4, 5, 2, true, false, 0, 0.23], [18, 5, 7, 3, true, false, 0, -1.1],
]

const row = (o: Partial<Row> & { score: number }): Row => ({
  putts: null,
  fairway_hit: null,
  gir: null,
  penalties: 0,
  sg_off_tee: null,
  sg_approach: null,
  sg_around_green: null,
  sg_putting: null,
  ...o,
})

// Hole 3's -2.52 is split over two columns (-2.00 tee, -0.52 approach) so the
// per-hole sum is exercised; every other hole carries its SG on approach.
const samHoles: HoleIn[] = RAW.map(([number, par, score, putts, fw, gir, pen, sg]) => ({
  number,
  par,
  score: row({
    score,
    putts,
    fairway_hit: fw,
    gir,
    penalties: pen,
    ...(number === 3 ? { sg_off_tee: -2, sg_approach: -0.52 } : { sg_approach: sg }),
  }),
}))

const base: ShareCardInput = {
  round: {
    played_at: '2026-10-31',
    tee_color: 'white',
    hole_count: 18,
    sg_total: 3.11,
    sg_off_tee: 2.08,
    sg_approach: -0.07,
    sg_around_green: -0.14,
    sg_putting: 1.23,
  },
  course: { name: 'Bear Creek Golf Club', city: 'Hilton Head Island', state: 'SC' },
  tee: { total_yards: 6162, course_rating: 71.5, slope_rating: 132 },
  handicapIndex: 12.4,
  holes: samHoles,
}

const scored = (holes: HoleIn[], keep: (n: number) => boolean): HoleIn[] =>
  holes.map((h) => (keep(h.number) ? h : { ...h, score: h.number % 2 ? row({ score: 0 }) : null }))

describe('shareCardModel — the full round (Sam, 18 holes)', () => {
  const m = shareCardModel(base)!

  it('heads the card: date, place, course, tee', () => {
    // 2026-10-31 is a Saturday
    expect(m.dateline).toBe('Sat 31 Oct 2026 · Hilton Head Island, SC')
    expect(m.course).toBe('Bear Creek Golf Club')
    expect(m.teeLine).toBe('White tees · 6,162 yd · 71.5 / 132')
  })

  it('totals over the 18 played: 44 + 45 = 89 on par 36 + 36 = 72, +17', () => {
    expect(m.totals).toEqual({ score: 89, par: 72, toPar: 17, holesPlayed: 18 })
    expect(m.holeCount).toBe(18)
    expect(m.partialLabel).toBeNull()
    expect(m.playedNine).toBeNull()
  })

  it('splits Out and In with par, score and putts per nine', () => {
    // Out par 4+3+4+5+4+4+5+3+4 = 36, score 4+4+8+6+5+5+4+4+4 = 44, putts 1+2+2+2+2+3+1+2+2 = 17
    // In  par 4+4+3+5+3+4+4+4+5 = 36, score 5+6+4+6+4+4+4+5+7 = 45, putts 2+2+2+2+2+1+1+2+3 = 17
    expect(m.nines.map(({ label, par, score, putts }) => ({ label, par, score, putts }))).toEqual([
      { label: 'Out', par: 36, score: 44, putts: 17 },
      { label: 'In', par: 36, score: 45, putts: 17 },
    ])
    expect(m.nines[0]!.holes.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(m.nines[1]!.holes.map((h) => h.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('gives each hole its to par (the mark) and the running to par (style 3)', () => {
    // to par:   0 +1 +4 +1 +1 +1 −1 +1  0 | +1 +2 +1 +1 +1  0  0 +1 +2
    // running:  0  1  5  6  7  8  7  8  8 |  9 11 12 13 14 14 14 15 17
    expect(m.holes.map((h) => h.toPar)).toEqual([0, 1, 4, 1, 1, 1, -1, 1, 0, 1, 2, 1, 1, 1, 0, 0, 1, 2])
    expect(m.holes.map((h) => h.runningToPar)).toEqual([0, 1, 5, 6, 7, 8, 7, 8, 8, 9, 11, 12, 13, 14, 14, 14, 15, 17])
    expect(m.holes[2]).toMatchObject({ number: 3, par: 4, score: 8, putts: 2 })
  })

  it('sums each hole\'s SG columns: hole 3 = −2.00 tee + −0.52 approach = −2.52', () => {
    expect(m.holes[2]!.sg).toBeCloseTo(-2.52, 10)
    expect(m.holes[6]!.sg).toBeCloseTo(1.86, 10)
  })

  it('counts the facts', () => {
    // putts 17 + 17 = 34
    // fairways: par 4s and 5s = 1,3,4,5,6,7,9 + 10,11,13,15,16,17,18 = 14; hit 1,4,5,6,9 + 11,17,18 = 8
    // GIR: holes 6, 7, 9 = 3 of 18; one penalty, on hole 3
    expect(m.facts).toEqual({
      putts: 34,
      fairways: { hit: 8, of: 14 },
      gir: { hit: 3, of: 18 },
      penalties: 1,
      penaltyNote: '1 penalty, on the 3rd',
    })
  })

  it('notes the worst hole and the first under par (style 3)', () => {
    // worst: hole 3, +4 (8 on a par 4); first under par: hole 7 (4 on a par 5)
    expect(m.highlights).toEqual({
      worst: { number: 3, text: '8 on the 3rd' },
      firstUnderPar: { number: 7, text: 'birdie on the 7th' },
    })
  })

  it('carries the round\'s SG with the per-hole best and worst (style 5)', () => {
    // 3.11 → 3.1 to the tenth; 12.4 → "a typical 12 handicap"
    // best hole 7 +1.86 (4 on a par 5); worst hole 3 −2.52 (8 on a par 4, 1 penalty)
    expect(m.sg).toEqual({
      total: 3.11,
      areas: [
        { key: 'sg_off_tee', label: 'Off the tee', value: 2.08 },
        { key: 'sg_approach', label: 'Approach', value: -0.07 },
        { key: 'sg_around_green', label: 'Around the green', value: -0.14 },
        { key: 'sg_putting', label: 'Putting', value: 1.23 },
      ],
      headline: '3.1 strokes better than a typical 12 handicap',
      basis: 'Strokes gained per hole, against a 12.4 handicap index',
      best: { number: 7, text: '4 on a par 5' },
      worst: { number: 3, text: '8 on a par 4, a penalty' },
    })
  })
})

describe('shareCardModel — the partial round (front nine of 18)', () => {
  // Holes 10–18 unplayed: odd numbers keep a score-0 row (mobile pre-creates
  // them), even numbers have no row (web creates rows as entered).
  const m = shareCardModel({
    ...base,
    round: { ...base.round, sg_total: 1.89, sg_off_tee: 0.13, sg_approach: 0.26, sg_around_green: 0.26, sg_putting: 1.24 },
    holes: scored(samHoles, (n) => n <= 9),
  })!

  it('shows only the holes played and says how many', () => {
    expect(m.holes.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(m.nines.map((n) => n.label)).toEqual(['Out'])
    expect(m.partialLabel).toBe('9 of 18 holes')
    expect(m.playedNine).toBe('front')
  })

  it('totals over the nine played: 44 on par 36, +8', () => {
    expect(m.totals).toEqual({ score: 44, par: 36, toPar: 8, holesPlayed: 9 })
    expect(m.holes[8]!.runningToPar).toBe(8)
  })

  it('counts facts over the nine played', () => {
    // putts 17; fairways 1,3,4,5,6,7,9 = 7, hit 1,4,5,6,9 = 5; GIR 6,7,9 = 3 of 9
    expect(m.facts).toMatchObject({ putts: 17, fairways: { hit: 5, of: 7 }, gir: { hit: 3, of: 9 } })
  })

  it('reads the SG headline off the round: 1.89 → 1.9', () => {
    expect(m.sg?.headline).toBe('1.9 strokes better than a typical 12 handicap')
    expect(m.sg?.best?.number).toBe(7)
    expect(m.sg?.worst?.number).toBe(3)
  })
})

describe('shareCardModel — which nine', () => {
  it('a back nine alone is "back", with In only', () => {
    const m = shareCardModel({ ...base, holes: scored(samHoles, (n) => n >= 10) })!
    expect(m.playedNine).toBe('back')
    expect(m.nines.map((n) => n.label)).toEqual(['In'])
    // In: 45 on 36
    expect(m.totals).toMatchObject({ score: 45, par: 36, toPar: 9 })
  })

  it('six holes of 18 is partial but not a nine', () => {
    const m = shareCardModel({ ...base, holes: scored(samHoles, (n) => n <= 6) })!
    expect(m.partialLabel).toBe('6 of 18 holes')
    expect(m.playedNine).toBeNull()
  })

  it('a 9-hole round played through is whole', () => {
    const m = shareCardModel({ ...base, round: { ...base.round, hole_count: 9 }, holes: samHoles.slice(0, 9) })!
    expect(m.partialLabel).toBeNull()
    expect(m.holeCount).toBe(9)
  })

  it('reads holes in number order whatever order they come in', () => {
    const m = shareCardModel({ ...base, holes: [...samHoles].reverse() })!
    expect(m.holes.map((h) => h.number)).toEqual(RAW.map(([n]) => n))
    expect(m.holes[17]!.runningToPar).toBe(17)
  })
})

describe('shareCardModel — no SG', () => {
  it('a round with no SG has none (style 5 not offered)', () => {
    const holes = samHoles.map((h) => ({ ...h, score: { ...h.score!, sg_off_tee: null, sg_approach: null } }))
    const m = shareCardModel({
      ...base,
      round: { ...base.round, sg_total: null, sg_off_tee: null, sg_approach: null, sg_around_green: null, sg_putting: null },
      holes,
    })!
    expect(m.sg).toBeNull()
    expect(m.holes.every((h) => h.sg === null)).toBe(true)
  })

  it('holes with SG but no round SG (never finished) has none', () => {
    const m = shareCardModel({ ...base, round: { ...base.round, sg_total: null } })!
    expect(m.sg).toBeNull()
    // the holes still carry theirs
    expect(m.holes[6]!.sg).toBeCloseTo(1.86, 10)
  })

  it('a round saved with sg_total 0 but no hole SG (no shots, #1436) has none either', () => {
    const holes = samHoles.map((h) => ({ ...h, score: { ...h.score!, sg_off_tee: null, sg_approach: null } }))
    const m = shareCardModel({ ...base, round: { ...base.round, sg_total: 0 }, holes })!
    expect(m.sg).toBeNull()
  })
})

describe('shareCardModel — the words', () => {
  const one = (o: Partial<Row> & { score: number }, par = 4, number = 1): HoleIn => ({ number, par, score: row(o) })

  it('nothing played → null', () => {
    expect(shareCardModel({ ...base, holes: [one({ score: 0 }), { number: 2, par: 4, score: null }] })).toBeNull()
  })

  it('drops the tee parts the round lacks', () => {
    expect(shareCardModel({ ...base, tee: null, round: { ...base.round, tee_color: null } })!.teeLine).toBeNull()
    expect(shareCardModel({ ...base, tee: null, round: { ...base.round, tee_color: 'blue' } })!.teeLine).toBe('Blue tees')
    // rating without slope prints neither
    expect(
      shareCardModel({ ...base, tee: { total_yards: 980, course_rating: 70.1, slope_rating: null } })!.teeLine,
    ).toBe('White tees · 980 yd')
  })

  it('a course with no place prints the date alone; no course reads "Round"', () => {
    const m = shareCardModel({ ...base, course: null, round: { ...base.round, played_at: '2026-01-05' } })!
    // 2026-01-05 is a Monday
    expect(m.dateline).toBe('Mon 5 Jan 2026')
    expect(m.course).toBe('Round')
  })

  it('fairways and GIR count only the holes where they were recorded', () => {
    // Three par 4s: fairway recorded on 1 (hit) and 2 (missed), blank on 3 → 1 of 2.
    // GIR recorded on 1 (hit) and 3 (missed), blank on 2 → 1 of 2.
    const m = shareCardModel({
      ...base,
      holes: [
        one({ score: 4, fairway_hit: true, gir: true }, 4, 1),
        one({ score: 5, fairway_hit: false }, 4, 2),
        one({ score: 5, gir: false }, 4, 3),
      ],
    })!
    expect(m.facts.fairways).toEqual({ hit: 1, of: 2 })
    expect(m.facts.gir).toEqual({ hit: 1, of: 2 })
  })

  it('facts not recorded are null, not 0', () => {
    const m = shareCardModel({ ...base, holes: [one({ score: 5 }), one({ score: 3 }, 3, 2)] })!
    expect(m.facts).toEqual({ putts: null, fairways: null, gir: null, penalties: 0, penaltyNote: null })
    expect(m.nines[0]!.putts).toBeNull()
  })

  it('names every hole with a penalty', () => {
    // 1 + 2 + 1 = 4 strokes on holes 3, 7, 11
    const m = shareCardModel({
      ...base,
      holes: [one({ score: 6, penalties: 1 }, 4, 3), one({ score: 7, penalties: 2 }, 5, 7), one({ score: 5, penalties: 1 }, 4, 11)],
    })!
    expect(m.facts.penaltyNote).toBe('4 penalties, on the 3rd, 7th and 11th')
    const two = shareCardModel({ ...base, holes: [one({ score: 6, penalties: 2 }, 4, 12)] })!
    expect(two.facts.penaltyNote).toBe('2 penalties, on the 12th')
  })

  it('names the first hole under par by what it was', () => {
    const first = (holes: HoleIn[]) => shareCardModel({ ...base, holes })!.highlights.firstUnderPar?.text
    expect(first([one({ score: 5 }), one({ score: 3 }, 5, 2), one({ score: 3 }, 4, 3)])).toBe('eagle on the 2nd')
    expect(first([one({ score: 2 }, 5, 1)])).toBe('albatross on the 1st')
    expect(first([one({ score: 1 }, 3, 11)])).toBe('hole in one on the 11th')
    expect(first([one({ score: 4 }), one({ score: 5 }, 4, 2)])).toBeUndefined()
  })

  it('no hole over par → no worst note; a tie goes to the earlier hole', () => {
    expect(shareCardModel({ ...base, holes: [one({ score: 4 }), one({ score: 3 }, 4, 2)] })!.highlights.worst).toBeNull()
    const tie = shareCardModel({ ...base, holes: [one({ score: 6 }, 4, 1), one({ score: 6 }, 4, 2)] })!
    expect(tie.highlights.worst).toEqual({ number: 1, text: '6 on the 1st' })
  })

  it('words the SG headline for a loss, level, a plus handicap and no handicap', () => {
    const sg = (total: number, handicapIndex: number | null) =>
      shareCardModel({ ...base, handicapIndex, round: { ...base.round, sg_total: total } })!.sg!
    expect(sg(-1.24, 12.4).headline).toBe('1.2 strokes worse than a typical 12 handicap')
    // −0.04 rounds to 0.0
    expect(sg(-0.04, 12.4).headline).toBe('Level with a typical 12 handicap')
    // a plus 2 is stored as −2
    expect(sg(3.11, -2).headline).toBe('3.1 strokes better than a typical +2 handicap')
    expect(sg(3.11, -2).basis).toBe('Strokes gained per hole, against a +2.0 handicap index')
    expect(sg(3.11, null).headline).toBe('3.1 strokes gained')
    expect(sg(-1.24, null).headline).toBe('1.2 strokes lost')
    expect(sg(0, null).headline).toBe('Level on strokes gained')
    expect(sg(3.11, null).basis).toBe('Strokes gained per hole')
  })

  it('SG best/worst: none gained → no best; two penalties named', () => {
    const m = shareCardModel({
      ...base,
      holes: [one({ score: 5, sg_putting: -0.4 }, 4, 1), one({ score: 8, penalties: 2, sg_off_tee: -1.5, sg_putting: 0.2 }, 4, 2)],
    })!
    // hole 2: −1.5 + 0.2 = −1.3, the worst
    expect(m.sg?.best).toBeNull()
    expect(m.sg?.worst).toEqual({ number: 2, text: '8 on a par 4, 2 penalties' })
  })
})
