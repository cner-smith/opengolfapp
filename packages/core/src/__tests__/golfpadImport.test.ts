import { describe, expect, it } from 'vitest'
import { golfPadFileKind, planGolfPadImport, readGolfPadExport } from '../golfpad-import'
import { computeRoundSG } from '../sg'
import type { Database } from '@oga/supabase'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

// Invented Golf Pad "comprehensive" exports (three CSVs, headers as Golf Pad writes them).
// Never a real player's export.
const ROUNDS_HEADER =
  'player name,date,start time,course name,course holes,tee name,rating,slope,course handicap,scoring format,completed holes,gross score,gross score over par,net score or points,putts,penalties,GIRs,fairways,sand shots,URL,finish time'
const HOLES_HEADER =
  'player name,date,course name,tee name,hole number,hole par,total strokes,putts,penalties,sand shots,fairway,GIR'
const SHOTS_HEADER =
  'date,course name,hole number,shot number,lie,club,club details,shot length yards,target distance before,target distance after,outcome,included in distance stats,strokes gained,distance from center of fairway before,distance from center of fairway after,time'

const round = (date: string, course: string, code: string, tee = '', completed = 18, start = '9:00', finish = '13:00', gross = 80) =>
  `Pat Example,${date},${start},${course},18,${tee},,,,Stroke Play,${completed},${gross},8,,30,0,5,6,1,https://www.golfpadgps.com/round/${code},${finish}`
const hole = (date: string, course: string, n: number, par: number, strokes: number, putts: number, penalties = 0, fairway = '', gir = '') =>
  `Pat Example,${date},${course},,${n},${par},${strokes},${putts},${penalties},0,${fairway},${gir}`
const shot = (date: string, course: string, holeN: number, n: number, lie: string, club: string, before: string, outcome: string, time = '9:10') =>
  `${date},${course},${holeN},${n},${lie},${club},"Brand X, Shaft Y, Grip Z",0,${before},0,${outcome},yes,0.1,,,${time}`

const csv = (header: string, rows: string[], eol = '\n') => [header, ...rows].join(eol) + eol

const C = 'Prairie Creek Golf Club - North'
const D = '6/7/2025'

describe('Golf Pad export → planned rounds', () => {
  it('maps a round, its holes and every shot field', () => {
    const plan = planGolfPadImport({
      rounds: csv(ROUNDS_HEADER, [round(D, C, 'R3K47HE2', 'White')], '\r\n'),
      holes: csv(
        HOLES_HEADER,
        [
          hole(D, C, 1, 4, 4, 2, 0, 'hit', 'GIR'),
          hole(D, C, 2, 3, 3, 2, 0, '', ''),
          hole(D, C, 3, 5, 9, 1, 1, 'left', ''),
          hole(D, C, 4, 4, 5, 2, 0, 'right', ''),
          hole(D, C, 5, 4, 4, 1, 0, 'hit', 'GIR'),
        ],
        '\r\n',
      ),
      shots: csv(SHOTS_HEADER, [
        shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway'),
        shot(D, C, 1, 2, 'Fairway', '7i', '150', 'Green'),
        shot(D, C, 1, 3, 'Green', 'Pt', '10', 'Green'),
        shot(D, C, 1, 4, 'Green', 'Pt', '1', 'Holed'),
        shot(D, C, 2, 1, 'Tee', '52° wedge', '100', 'Green'),
        shot(D, C, 2, 2, 'Green', 'Pt', '4', 'Green'),
        shot(D, C, 2, 3, 'Green', 'Pt', '', 'Holed'),
        // Golf Pad gives the penalty stroke a number (2) but no row.
        shot(D, C, 3, 1, 'Tee', '3w', '520', 'Penalty'),
        shot(D, C, 3, 3, 'Recovery', '3h', '300', 'Rough'),
        shot(D, C, 3, 4, 'Rough', '5w', '200', 'Sand'),
        shot(D, C, 3, 5, 'Sand', 'SW', '40', 'Fringe'),
        shot(D, C, 3, 6, 'Fringe', 'Ch', '15', 'Rough'),
        shot(D, C, 3, 7, 'Rough', '56° wedge', '12', 'Rough'),
        shot(D, C, 3, 8, 'Rough', '60° wedge', '8', 'Green'),
        shot(D, C, 3, 9, 'Green', 'Pt', '2', 'Holed'),
        // Hole 4: score 5 but only three rows (putts not logged as shots).
        shot(D, C, 4, 1, 'Tee', 'D', '380', 'Fairway'),
        shot(D, C, 4, 2, 'Fairway', 'PW', '120', 'Rough'),
        shot(D, C, 4, 3, 'Rough', 'LW', '20', 'Green'),
        shot(D, C, 5, 1, 'Tee', '3i', '210', 'Fairway'),
        shot(D, C, 5, 2, 'Fairway', '7w', '190', 'Fairway'),
        shot(D, C, 5, 3, 'Fairway', 'GW', '30', 'Green'),
        shot(D, C, 5, 4, 'Green', 'Pt', '2', 'Holed'),
      ]),
    })

    expect(plan.skipped).toEqual([])
    expect(plan.rounds).toHaveLength(1)
    const r = plan.rounds[0]!
    expect(r).toMatchObject({ import_id: 'golfpad:R3K47HE2', course_name: C, played_at: '2025-06-07', tee_color: 'white' })
    expect(r.holes.map((h) => [h.number, h.par, h.score, h.putts, h.penalties, h.fairway_hit, h.gir])).toEqual([
      [1, 4, 4, 2, 0, true, true],
      [2, 3, 3, 2, 0, null, false],
      [3, 5, 9, 1, 1, false, false],
      [4, 4, 5, 2, 0, false, false],
      [5, 4, 4, 1, 0, true, true],
    ])
    const [h1, h2, h3, h4, h5] = r.holes
    expect(h5!.shots.map((s) => s.club)).toEqual(['3i', '7w', 'gw', 'putter'])
    expect(h1!.shots).toEqual([
      { shot_number: 1, lie_type: 'tee', club: 'driver', distance_to_target: 400, putt_distance_ft: null, penalty: false },
      { shot_number: 2, lie_type: 'fairway', club: '7i', distance_to_target: 150, putt_distance_ft: null, penalty: false },
      { shot_number: 3, lie_type: 'green', club: 'putter', distance_to_target: 10, putt_distance_ft: 30, penalty: false },
      { shot_number: 4, lie_type: 'green', club: 'putter', distance_to_target: 1, putt_distance_ft: 3, penalty: false },
    ])
    expect(h2!.shots.map((s) => [s.club, s.distance_to_target, s.putt_distance_ft])).toEqual([
      ['gw', 100, null],
      ['putter', 4, 12],
      ['putter', null, null],
    ])
    // Renumbered by row, as OGA numbers shots: the penalty is a flag on the shot, not a row.
    expect(h3!.shots.map((s) => [s.shot_number, s.lie_type, s.club, s.penalty])).toEqual([
      [1, 'tee', '3w', true],
      [2, 'recovery', '3h', false],
      [3, 'rough', '5w', false],
      [4, 'sand', 'sw', false],
      [5, 'fringe', null, false],
      [6, 'rough', 'sw', false],
      [7, 'rough', 'lw', false],
      [8, 'green', 'putter', false],
    ])
    expect(h1!.scores_only).toBeNull()
    expect(h3!.scores_only).toBeNull()
    expect(h4!.shots).toEqual([])
    expect(h4!.scores_only).toBe('strokes_missing')
  })

  it('a partial round keeps only the holes played (no strokes = not played); a hole with no shot rows gets none', () => {
    const plan = planGolfPadImport({
      rounds: csv(ROUNDS_HEADER, [round(D, C, 'R9', '', 2)]),
      holes: csv(HOLES_HEADER, [hole(D, C, 10, 4, 5, 2), hole(D, C, 11, 3, 3, 1), hole(D, C, 12, 4, 0, 0).replace(',4,0,0,0,0,,', ',4,,,,0,,')]),
      shots: csv(SHOTS_HEADER, [shot(D, C, 11, 1, 'Tee', '9i', '140', 'Green'), shot(D, C, 11, 2, 'Green', 'Pt', '3', 'Green'), shot(D, C, 11, 3, 'Green', 'Pt', '1', 'Holed')]),
    })
    const r = plan.rounds[0]!
    expect(r.holes.map((h) => h.number)).toEqual([10, 11])
    expect(r.holes[0]).toMatchObject({ shots: [], scores_only: 'no_shots' })
    expect(r.holes[1]!.shots).toHaveLength(3)
  })

  it('a hole whose shots don’t add up to the score imports the score only, with the reason', () => {
    const plan = planGolfPadImport({
      rounds: csv(ROUNDS_HEADER, [round(D, C, 'R1')]),
      holes: csv(HOLES_HEADER, [
        hole(D, C, 1, 4, 5, 2),
        hole(D, C, 2, 4, 5, 1, 1),
        hole(D, C, 3, 4, 6, 1, 1),
        hole(D, C, 4, 3, 3, 1),
        hole(D, C, 5, 4, 5, 2, 1),
        hole(D, C, 6, 3, 3, 2),
      ]),
      shots: csv(SHOTS_HEADER, [
        // 1: putts not logged — the last row isn't holed.
        shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway'),
        shot(D, C, 1, 2, 'Fairway', '7i', '150', 'Green'),
        shot(D, C, 1, 3, 'Green', 'Pt', '10', 'Green'),
        // 2: a penalty in the hole's column, no Penalty row; four rows for 5 strokes.
        shot(D, C, 2, 1, 'Tee', 'D', '400', 'Rough'),
        shot(D, C, 2, 2, 'Rough', '6i', '170', 'Green'),
        shot(D, C, 2, 3, 'Green', 'Pt', '20', 'Green'),
        shot(D, C, 2, 4, 'Green', 'Pt', '2', 'Holed'),
        // 3: same, with Golf Pad's gap after a row that isn't the Penalty.
        shot(D, C, 3, 1, 'Tee', 'D', '400', 'Rough'),
        shot(D, C, 3, 3, 'Rough', '6i', '170', 'Rough'),
        shot(D, C, 3, 4, 'Rough', 'SW', '30', 'Green'),
        shot(D, C, 3, 5, 'Green', 'Pt', '8', 'Green'),
        shot(D, C, 3, 6, 'Green', 'Pt', '1', 'Holed'),
        // 4: shot 2 missing, nothing explains the gap.
        shot(D, C, 4, 1, 'Tee', '8i', '150', 'Rough'),
        shot(D, C, 4, 3, 'Rough', 'PW', '30', 'Green'),
        shot(D, C, 4, 4, 'Green', 'Pt', '2', 'Holed'),
        // 5: adds up — Penalty, its stroke (2), then three rows.
        shot(D, C, 5, 1, 'Tee', 'D', '400', 'Penalty'),
        shot(D, C, 5, 3, 'Rough', '7i', '160', 'Green'),
        shot(D, C, 5, 4, 'Green', 'Pt', '12', 'Green'),
        shot(D, C, 5, 5, 'Green', 'Pt', '1', 'Holed'),
        // 6: three rows for 3 strokes, but the last one isn't holed.
        shot(D, C, 6, 1, 'Tee', '8i', '150', 'Green'),
        shot(D, C, 6, 2, 'Green', 'Pt', '20', 'Green'),
        shot(D, C, 6, 3, 'Green', 'Pt', '3', 'Green'),
      ]),
    })
    const holes = plan.rounds[0]!.holes
    expect(holes.map((h) => [h.number, h.scores_only, h.shots.length])).toEqual([
      [1, 'strokes_missing', 0],
      [2, 'penalty_no_row', 0],
      [3, 'penalty_no_row', 0],
      [4, 'numbers_mismatch', 0],
      [5, null, 4],
      [6, 'strokes_missing', 0],
    ])
    expect(holes[4]!.shots.map((s) => [s.shot_number, s.penalty])).toEqual([[1, true], [2, false], [3, false], [4, false]])
  })

  it('skips rounds it can’t place: same course twice that day, no hole rows, or no round id', () => {
    const other = 'Elm Park Golf Course'
    const plan = planGolfPadImport({
      rounds: csv(ROUNDS_HEADER, [
        round(D, C, 'RA', '', 9, '8:00', '10:00'),
        round(D, C, 'RB', '', 9, '11:00', '13:00'),
        round(D, other, 'RC'),
        round('6/8/2025', other, 'RD'),
        round('6/9/2025', other, 'RE').replace(/https:\S+round\/RE/, ''),
      ]),
      holes: csv(HOLES_HEADER, [hole(D, C, 1, 4, 4, 2), hole(D, C, 1, 4, 5, 2), hole('6/8/2025', other, 1, 4, 4, 2)]),
      shots: csv(SHOTS_HEADER, []),
    })
    expect(plan.rounds.map((r) => r.import_id)).toEqual(['golfpad:RD'])
    expect(plan.skipped).toEqual([
      { import_id: 'golfpad:RA', course_name: C, played_at: '2025-06-07', reason: 'same_day' },
      { import_id: 'golfpad:RB', course_name: C, played_at: '2025-06-07', reason: 'same_day' },
      { import_id: 'golfpad:RC', course_name: other, played_at: '2025-06-07', reason: 'no_holes' },
      { import_id: '', course_name: other, played_at: '2025-06-09', reason: 'no_round_id' },
    ])
  })

  describe('same course twice in one day', () => {
    // Golf Pad lists the day's rounds in start order, and their holes in the same order.
    const rounds = csv(ROUNDS_HEADER, [
      round(D, C, 'RA', '', 2, '8:00', '10:00', 9),
      round(D, C, 'RB', '', 2, '11:00', '13:00', 7),
    ])
    const holes = csv(HOLES_HEADER, [hole(D, C, 1, 4, 4, 1), hole(D, C, 2, 4, 5, 2), hole(D, C, 1, 4, 3, 1), hole(D, C, 2, 4, 4, 2)])
    const shotsA = [
      shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway', '8:10'),
      shot(D, C, 1, 2, 'Fairway', '7i', '150', 'Rough', '8:14'),
      shot(D, C, 1, 3, 'Rough', 'SW', '20', 'Green', '8:18'),
      shot(D, C, 1, 4, 'Green', 'Pt', '2', 'Holed', '8:20'),
    ]
    const shotsB = [
      shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway', '11:05'),
      shot(D, C, 1, 2, 'Fairway', '9i', '140', 'Green', '11:09'),
      shot(D, C, 1, 3, 'Green', 'Pt', '5', 'Holed', '13:00'),
    ]

    it('splits holes where the number drops and shots by time: each round gets only its own', () => {
      const plan = planGolfPadImport({ rounds, holes, shots: csv(SHOTS_HEADER, [...shotsB, ...shotsA]) })
      expect(plan.skipped).toEqual([])
      expect(plan.rounds.map((r) => [r.import_id, r.holes.map((h) => [h.number, h.score, h.shots.length])])).toEqual([
        ['golfpad:RA', [[1, 4, 4], [2, 5, 0]]],
        ['golfpad:RB', [[1, 3, 3], [2, 4, 0]]],
      ])
      expect(plan.rounds[1]!.holes[0]!.shots.map((s) => s.club)).toEqual(['driver', '9i', 'putter'])
    })

    it('pairs holes with rounds by start time, whatever order the rounds file lists them in', () => {
      const reversed = csv(ROUNDS_HEADER, rounds.trim().split('\n').slice(1).reverse())
      const plan = planGolfPadImport({ rounds: reversed, holes, shots: csv(SHOTS_HEADER, [...shotsA, ...shotsB]) })
      expect(plan.rounds.map((r) => [r.import_id, r.holes.map((h) => h.score)])).toEqual([
        ['golfpad:RB', [3, 4]],
        ['golfpad:RA', [4, 5]],
      ])
    })

    const skippedBoth = (plan: ReturnType<typeof planGolfPadImport>) => {
      expect(plan.rounds).toEqual([])
      expect(plan.skipped.map((s) => [s.import_id, s.reason])).toEqual([['golfpad:RA', 'same_day'], ['golfpad:RB', 'same_day']])
    }

    it('a shot outside both rounds’ times → both skipped', () => {
      skippedBoth(planGolfPadImport({ rounds, holes, shots: csv(SHOTS_HEADER, [...shotsA, shot(D, C, 2, 1, 'Tee', 'D', '400', 'Fairway', '10:30')]) }))
    })

    it('a shot in both rounds’ times → both skipped', () => {
      const overlapping = rounds.replace(',11:00,', ',9:30,')
      skippedBoth(planGolfPadImport({ rounds: overlapping, holes, shots: csv(SHOTS_HEADER, [shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway', '9:45')]) }))
    })

    it('a repeated hole number also starts the next round', () => {
      const oneHoleEach = csv(ROUNDS_HEADER, [round(D, C, 'RA', '', 1, '8:00', '10:00', 4), round(D, C, 'RB', '', 1, '11:00', '13:00', 3)])
      const plan = planGolfPadImport({ rounds: oneHoleEach, holes: csv(HOLES_HEADER, [hole(D, C, 1, 4, 4, 1), hole(D, C, 1, 4, 3, 1)]), shots: csv(SHOTS_HEADER, []) })
      expect(plan.rounds.map((r) => r.holes.map((h) => h.score))).toEqual([[4], [3]])
    })

    it('more runs of hole numbers than rounds → both skipped', () => {
      const threeRuns = holes + csv(HOLES_HEADER, [hole(D, C, 1, 4, 5, 2)]).split('\n').slice(1).join('\n')
      skippedBoth(planGolfPadImport({ rounds, holes: threeRuns, shots: csv(SHOTS_HEADER, shotsA) }))
    })

    it('a part whose strokes aren’t its round’s gross score → both skipped', () => {
      const swapped = csv(ROUNDS_HEADER, [round(D, C, 'RA', '', 2, '8:00', '10:00', 7), round(D, C, 'RB', '', 2, '11:00', '13:00', 9)])
      skippedBoth(planGolfPadImport({ rounds: swapped, holes, shots: csv(SHOTS_HEADER, shotsA) }))
    })
  })

  describe('reading the chosen files', () => {
    const roundsCsv = csv(ROUNDS_HEADER, [round(D, C, 'R1')])
    const holesCsv = csv(HOLES_HEADER, [hole(D, C, 1, 4, 4, 2)])
    const shotsCsv = csv(SHOTS_HEADER, [shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway')])
    const rejected = (texts: string[]) => {
      const read = readGolfPadExport(texts)
      return 'rejected' in read ? read.rejected : null
    }

    it('names each file by its header line alone (the ledger on the import page)', () => {
      expect(golfPadFileKind(roundsCsv)).toBe('rounds')
      expect(golfPadFileKind(csv(HOLES_HEADER, [hole(D, C, 1, 4, 4, 2)], '\r\n'))).toBe('holes')
      expect(golfPadFileKind(shotsCsv)).toBe('shots')
      // A rounds column named in a later line doesn't make a holes file a rounds file.
      expect(golfPadFileKind(csv(HOLES_HEADER, ['gross score,,,,1,4,4,2,0,0,,']))).toBe('holes')
      expect(golfPadFileKind(csv('a,b', ['gross score,shot number']))).toBeNull()
      expect(golfPadFileKind('')).toBeNull()
    })

    it('tells the three files apart by their headers, in any order', () => {
      const read = readGolfPadExport([shotsCsv, roundsCsv, holesCsv])
      expect('plan' in read && read.plan.rounds.map((r) => r.import_id)).toEqual(['golfpad:R1'])
    })

    it('a rounds file alone (the rounds-only export, or one file of three) asks for the comprehensive export', () => {
      expect(rejected([roundsCsv])).toMatch(/Only a rounds file was chosen.*no holes or shots.*comprehensive export, a Golf Pad Premium option/)
    })

    it('names the missing file', () => {
      expect(rejected([roundsCsv, holesCsv])).toBe('The shots file is missing. Choose all three Golf Pad files: rounds, holes and shots.')
      expect(rejected([shotsCsv, holesCsv])).toBe('The rounds file is missing. Choose all three Golf Pad files: rounds, holes and shots.')
      expect(rejected([holesCsv])).toBe('The rounds and shots files are missing. Choose all three Golf Pad files: rounds, holes and shots.')
    })

    it('no Golf Pad file at all', () => {
      expect(rejected([csv('a,b', ['1,2'])])).toMatch(/aren’t Golf Pad export files/)
    })

    it('a meters export is rejected: Golf Pad names the unit in the shot length header', () => {
      const meters = csv(SHOTS_HEADER.replace('shot length yards', 'shot length meters'), [])
      expect(rejected([roundsCsv, holesCsv, meters])).toBe('This export measures distances in meters (Golf Pad picks the unit from where you play). The import reads yards only for now.')
    })

    it('a shots file with no yards column isn’t called meters', () => {
      const unknown = csv(SHOTS_HEADER.replace('shot length yards', 'shot length'), [])
      expect(rejected([roundsCsv, holesCsv, unknown])).toMatch(/no “shot length yards” column/)
    })
  })

  it('an imported hole’s strokes gained matches the hand-worked hole', () => {
    // Same hole as sgWorkedHoles "par 4 in four, 15 handicap": tee 400 yd, approach 150 yd,
    // putts from 30 ft and 3 ft. Lookups (sg-baselines, bracket 15):
    //   tee 2.79 + 0.0066·400 = 5.43 · APPROACH[15][150] = 3.95 · PUTTING[15][30] = 2.34 · PUTTING[15][3] = 1.10
    // off tee 0.48 · approach 0.61 · putting 0.24 + 0.10 = 0.34 · total 1.43
    const plan = planGolfPadImport({
      rounds: csv(ROUNDS_HEADER, [round(D, C, 'R1')]),
      holes: csv(HOLES_HEADER, [hole(D, C, 1, 4, 4, 2)]),
      shots: csv(SHOTS_HEADER, [
        shot(D, C, 1, 1, 'Tee', 'D', '400', 'Fairway'),
        shot(D, C, 1, 2, 'Fairway', '7i', '150', 'Green'),
        shot(D, C, 1, 3, 'Green', 'Pt', '10', 'Green'),
        shot(D, C, 1, 4, 'Green', 'Pt', '1', 'Holed'),
      ]),
    })
    const h = plan.rounds[0]!.holes[0]!
    const sg = computeRoundSG({
      holes: [{ id: 'h1', course_id: 'c', number: 1, par: h.par, stroke_index: null, yards: null } as unknown as HoleRow],
      holeScores: [{ id: 'hs1', round_id: 'r', hole_id: 'h1', score: h.score, par: null } as unknown as HoleScoreRow],
      shots: h.shots.map((s) => ({ ...s, id: `s${s.shot_number}`, hole_score_id: 'hs1', ob: false, start_lat: null, start_lng: null, putt_result: null }) as unknown as ShotRow),
      handicap: 15,
    }).round
    expect(sg.offTee).toBeCloseTo(0.48, 2)
    expect(sg.approach).toBeCloseTo(0.61, 2)
    expect(sg.putting).toBeCloseTo(0.34, 2)
    expect(sg.total).toBeCloseTo(1.43, 2)
  })
})
