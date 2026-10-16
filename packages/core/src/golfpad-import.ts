// Golf Pad "comprehensive" export (rounds, holes, shots CSVs) → rounds ready to import (#1134).
// The caller decodes the files (Golf Pad writes Windows-1252) and passes the text. Distances are
// yards; "target distance before" is the distance to the pin. Unknown values become null, never
// guessed.

import type { LieType } from './constants'

export interface GolfPadFiles {
  rounds: string
  holes: string
  shots: string
}

export interface GolfPadShot {
  shot_number: number
  lie_type: LieType | null
  club: string | null
  distance_to_target: number | null
  putt_distance_ft: number | null
  penalty: boolean
}

export interface GolfPadHole {
  number: number
  par: number
  score: number
  putts: number | null
  penalties: number
  fairway_hit: boolean | null
  gir: boolean
  shots: GolfPadShot[]
  /** Why the hole imports without shots (SG would be wrong); null when its shots are kept. */
  scores_only: GolfPadScoresOnlyReason | null
}

export type GolfPadScoresOnlyReason = 'no_shots' | 'strokes_missing' | 'penalty_no_row' | 'numbers_mismatch'

export interface GolfPadRound {
  /** `golfpad:` + Golf Pad's round code (from the round URL). */
  import_id: string
  course_name: string
  /** YYYY-MM-DD */
  played_at: string
  tee_color: string | null
  holes: GolfPadHole[]
}

export type GolfPadSkipReason = 'same_day' | 'no_holes' | 'no_round_id'

export interface GolfPadSkip {
  import_id: string
  course_name: string
  played_at: string
  reason: GolfPadSkipReason
}

export interface GolfPadPlan {
  rounds: GolfPadRound[]
  skipped: GolfPadSkip[]
}

type Row = Record<string, string>

// RFC 4180 rows: quoted fields may hold commas and doubled quotes. CRLF or LF.
function parseCsv(text: string): Row[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows.filter((r) => r.some((f) => f !== ''))
  if (!header) return []
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

const CLUBS: Record<string, string> = {
  D: 'driver', '3w': '3w', '5w': '5w', '7w': '7w', '3h': '3h', '4h': '4h', '5h': '5h',
  '2i': '2i', '3i': '3i', '4i': '4i', '5i': '5i', '6i': '6i', '7i': '7i', '8i': '8i', '9i': '9i',
  PW: 'pw', GW: 'gw', AW: 'gw', SW: 'sw', LW: 'lw', Pt: 'putter',
}

function club(code: string): string | null {
  const loft = /^(\d+)°\s*wedge$/i.exec(code)
  if (loft) {
    const deg = Number(loft[1])
    return deg <= 53 ? 'gw' : deg <= 57 ? 'sw' : 'lw'
  }
  return CLUBS[code] ?? null
}

const LIES: Record<string, LieType> = {
  Tee: 'tee', Fairway: 'fairway', Rough: 'rough', Sand: 'sand', Fringe: 'fringe', Recovery: 'recovery', Green: 'green',
}

const int = (s: string | undefined): number | null => (s && /^\d+$/.test(s) ? Number(s) : null)

// M/D/YYYY → YYYY-MM-DD; '' when malformed (the import schema then rejects that round).
function isoDate(s: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}` : ''
}

// Shots are kept only when they account for every stroke: SG books a hole's last row as holed,
// so unlogged putts would inflate it. Golf Pad numbers a penalty stroke but gives it no row, so
// the only gap allowed is the one number after a Penalty row.
function scoresOnlyReason(rows: Row[], score: number, penalties: number): GolfPadScoresOnlyReason | null {
  if (rows.length === 0) return 'no_shots'
  let next = 1
  let penaltyRows = 0
  for (const s of rows) {
    // Best guess at the reason: with a penalty the rows don't carry, blame the gap on it.
    if (int(s['shot number']) !== next) return penalties > penaltyRows ? 'penalty_no_row' : 'numbers_mismatch'
    const penalty = s['outcome'] === 'Penalty'
    if (penalty) penaltyRows++
    next += penalty ? 2 : 1
  }
  if (penaltyRows < penalties) return 'penalty_no_row'
  if (next - 1 < score || rows[rows.length - 1]!['outcome'] !== 'Holed') return 'strokes_missing'
  if (next - 1 > score || penaltyRows > penalties) return 'numbers_mismatch'
  return null
}

interface OwnRows {
  holes: Row[]
  shots: Row[]
}

function groupBy(rows: Row[], key: (r: Row) => string): Map<string, Row[]> {
  const out = new Map<string, Row[]>()
  for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), r])
  return out
}

// H:MM → minutes since midnight; NaN when missing, so the shot fits no round.
function minutes(t: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

// One course on one day → each round's hole and shot rows, or null when its rounds can't be told
// apart. `rounds` come in start order; Golf Pad lists their holes in that order too, so a
// new round's holes start where the hole number doesn't go up; each part must add up to its
// round's gross score. A shot belongs to the one round whose start–finish holds its time.
function splitDay(rounds: Row[], holes: Row[], shots: Row[]): OwnRows[] | null {
  if (rounds.length === 1) return [{ holes, shots }]
  const parts: Row[][] = []
  let prev = Infinity
  for (const h of holes) {
    const n = int(h['hole number']) ?? 0
    if (n <= prev) parts.push([])
    parts[parts.length - 1]!.push(h)
    prev = n
  }
  if (parts.length !== rounds.length) return null
  const strokes = (p: Row[]) => p.reduce((t, h) => t + (int(h['total strokes']) ?? 0), 0)
  if (parts.some((p, i) => strokes(p) !== int(rounds[i]!['gross score']))) return null
  const split = parts.map((p) => ({ holes: p, shots: [] as Row[] }))
  for (const s of shots) {
    const t = minutes(s['time'])
    const inside = rounds.flatMap((r, i) => (minutes(r['start time']) <= t && t <= minutes(r['finish time']) ? [i] : []))
    if (inside.length !== 1) return null
    split[inside[0]!]!.shots.push(s)
  }
  return split
}

const roundKey = (r: Row) => `${r['date']}|${r['course name']}`

export function planGolfPadImport(files: GolfPadFiles): GolfPadPlan {
  const roundRows = parseCsv(files.rounds)
  const holeRows = parseCsv(files.holes)
  const shotRows = parseCsv(files.shots)

  const holesByKey = groupBy(holeRows, roundKey)
  const shotsByKey = groupBy(shotRows, roundKey)
  // Each round's own hole and shot rows; null when its day can't be split.
  const own = new Map<Row, OwnRows | null>()
  for (const [key, group] of groupBy(roundRows, roundKey)) {
    const rounds = [...group].sort((a, b) => minutes(a['start time']) - minutes(b['start time']))
    const split = splitDay(rounds, holesByKey.get(key) ?? [], shotsByKey.get(key) ?? [])
    rounds.forEach((r, i) => own.set(r, split?.[i] ?? null))
  }

  const plan: GolfPadPlan = { rounds: [], skipped: [] }
  for (const r of roundRows) {
    const code = /\/round\/(\w+)/.exec(r['URL'] ?? '')?.[1]
    const base = {
      import_id: code ? `golfpad:${code}` : '',
      course_name: r['course name'] ?? '',
      played_at: isoDate(r['date'] ?? ''),
    }
    if (!code) { plan.skipped.push({ ...base, reason: 'no_round_id' }); continue }
    const mine = own.get(r)
    if (!mine) { plan.skipped.push({ ...base, reason: 'same_day' }); continue }
    // A hole with no strokes wasn't played.
    const holes = mine.holes.filter((h) => (int(h['total strokes']) ?? 0) > 0)
    if (holes.length === 0) { plan.skipped.push({ ...base, reason: 'no_holes' }); continue }

    plan.rounds.push({
      ...base,
      tee_color: r['tee name'] ? r['tee name']!.toLowerCase() : null,
      holes: holes.map((h) => {
        const score = int(h['total strokes']) ?? 0
        const rows = mine.shots
          .filter((s) => s['hole number'] === h['hole number'])
          .sort((a, b) => (int(a['shot number']) ?? 0) - (int(b['shot number']) ?? 0))
        const penalties = int(h['penalties']) ?? 0
        const scoresOnly = scoresOnlyReason(rows, score, penalties)
        const fairway = h['fairway']
        return {
          number: int(h['hole number']) ?? 0,
          par: int(h['hole par']) ?? 4,
          score,
          putts: int(h['putts']),
          penalties,
          fairway_hit: fairway === 'hit' ? true : fairway === 'left' || fairway === 'right' ? false : null,
          // Golf Pad leaves a missed green blank.
          gir: h['GIR'] === 'GIR',
          scores_only: scoresOnly,
          shots: scoresOnly
            ? []
            : rows.map((s, i) => {
                const lie = LIES[s['lie'] ?? ''] ?? null
                const yards = int(s['target distance before'])
                return {
                  // OGA numbers shots by row; the penalty is a flag on its shot.
                  shot_number: i + 1,
                  lie_type: lie,
                  club: club(s['club'] ?? ''),
                  distance_to_target: yards,
                  putt_distance_ft: lie === 'green' && yards != null ? yards * 3 : null,
                  penalty: s['outcome'] === 'Penalty',
                }
              }),
        }
      }),
    })
  }
  return plan
}
