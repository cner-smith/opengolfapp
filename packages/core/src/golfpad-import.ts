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
  /** Null when the source has no par: the course's par applies. */
  par: number | null
  score: number
  putts: number | null
  penalties: number
  fairway_hit: boolean | null
  gir: boolean | null
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

export interface CsvRecord {
  /** The line the record starts on, counting from 1 (a quoted field can span lines). */
  line: number
  cells: string[]
  /** The text ended inside a quoted field. */
  unclosed: boolean
}

// RFC 4180 records: quoted fields may hold commas, newlines and doubled quotes. CRLF or LF. Blank
// lines come back as one empty cell.
export function csvRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = []
  let cells: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let start = 1
  const end = () => { cells.push(field); records.push({ line: start, cells, unclosed: false }); cells = []; field = ''; start = line }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { cells.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') { i++; line++ }
      end()
    } else field += c
  }
  if (field || cells.length || quoted) { end(); records[records.length - 1]!.unclosed = quoted }
  return records
}

function parseCsv(text: string): Row[] {
  const rows = csvRecords(text).map((r) => r.cells).filter((r) => r.some((f) => f !== ''))
  const [header, ...body] = rows
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
  for (const r of rows) {
    const k = key(r)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(r)
  }
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

export type GolfPadRead = { plan: GolfPadPlan } | { rejected: string }

const ALL_THREE = 'Choose all three Golf Pad files: rounds, holes and shots.'

export type GolfPadFileKind = 'rounds' | 'holes' | 'shots'

// Which Golf Pad export file a decoded CSV is, by its header (names are the player's to change).
export function golfPadFileKind(text: string): GolfPadFileKind | null {
  const header = text.slice(0, text.search(/\r?\n|$/))
  if (header.includes('gross score')) return 'rounds'
  if (header.includes('total strokes')) return 'holes'
  if (header.includes('shot number')) return 'shots'
  return null
}

// The player's chosen files (decoded text, any order) → the plan, or why they can't be imported. Files
// are told apart by their headers, not their names. Golf Pad picks the distance unit from where the
// player is and names it in the shots file's "shot length" column; there's no setting to change it.
export function readGolfPadExport(texts: string[]): GolfPadRead {
  const found: Partial<GolfPadFiles> = {}
  let shotsHeader = ''
  for (const text of texts) {
    const kind = golfPadFileKind(text)
    if (kind) found[kind] = text
    if (kind === 'shots') shotsHeader = text.slice(0, text.search(/\r?\n|$/))
  }
  const { rounds, holes, shots } = found
  if (!rounds && !holes && !shots) {
    return { rejected: 'These aren’t Golf Pad export files. Choose the rounds, holes and shots CSV files from Golf Pad’s comprehensive export.' }
  }
  // The rounds-only export is the rounds file alone, so it reads the same as picking just that file.
  if (rounds && !holes && !shots) {
    return {
      rejected:
        'Only a rounds file was chosen. Golf Pad’s rounds-only export has no holes or shots: choose all three files (rounds, holes and shots) from the comprehensive export, a Golf Pad Premium option under Settings → Data Export.',
    }
  }
  if (!rounds || !holes || !shots) {
    const missing = (['rounds', 'holes', 'shots'] as const).filter((f) => !found[f])
    const what = missing.length === 1 ? `The ${missing[0]} file is` : `The ${missing.join(' and ')} files are`
    return { rejected: `${what} missing. ${ALL_THREE}` }
  }
  if (shotsHeader.includes('shot length meters')) {
    return { rejected: 'This export measures distances in meters (Golf Pad picks the unit from where you play). The import reads yards only for now.' }
  }
  if (!shotsHeader.includes('shot length yards')) {
    return { rejected: 'The shots file has no “shot length yards” column, so it isn’t a Golf Pad comprehensive export this import can read.' }
  }
  return { plan: planGolfPadImport({ rounds, holes, shots }) }
}
