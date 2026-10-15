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
  gir: boolean | null
  shots: GolfPadShot[]
  /** Shot rows existed but didn't add up to the score, so none are imported (SG would be wrong). */
  shots_dropped: boolean
}

export interface GolfPadRound {
  /** Golf Pad's round code (from the round URL). */
  import_id: string
  course_name: string
  /** YYYY-MM-DD */
  played_at: string
  tee_color: string | null
  holes: GolfPadHole[]
}

export type GolfPadSkipReason = 'same_day' | 'no_holes'

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

// RFC 4180 rows: quoted fields may hold commas and doubled quotes. CRLF or LF.
function parseCsv(text: string): Record<string, string>[] {
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
  D: 'driver', '3w': '3w', '5w': '5w', '3h': '3h', '4h': '4h',
  '4i': '4i', '5i': '5i', '6i': '6i', '7i': '7i', '8i': '8i', '9i': '9i',
  PW: 'pw', SW: 'sw', LW: 'lw', Pt: 'putter',
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

// M/D/YYYY → YYYY-MM-DD
function isoDate(s: string): string {
  const [m, d, y] = s.split('/')
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
}

const roundKey = (r: Record<string, string>) => `${r['date']}|${r['course name']}`

export function planGolfPadImport(files: GolfPadFiles): GolfPadPlan {
  const roundRows = parseCsv(files.rounds)
  const holeRows = parseCsv(files.holes)
  const shotRows = parseCsv(files.shots)

  const roundsPerKey = new Map<string, number>()
  for (const r of roundRows) roundsPerKey.set(roundKey(r), (roundsPerKey.get(roundKey(r)) ?? 0) + 1)
  const holesByKey = new Map<string, Record<string, string>[]>()
  for (const h of holeRows) holesByKey.set(roundKey(h), [...(holesByKey.get(roundKey(h)) ?? []), h])
  const shotsByHole = new Map<string, Record<string, string>[]>()
  for (const s of shotRows) {
    const k = `${roundKey(s)}|${s['hole number']}`
    shotsByHole.set(k, [...(shotsByHole.get(k) ?? []), s])
  }

  const plan: GolfPadPlan = { rounds: [], skipped: [] }
  for (const r of roundRows) {
    const key = roundKey(r)
    const base = {
      import_id: (r['URL'] ?? '').split('/').pop() ?? '',
      course_name: r['course name'] ?? '',
      played_at: isoDate(r['date'] ?? ''),
    }
    // ponytail: two rounds on one course that day are skipped until #1138 splits them.
    if ((roundsPerKey.get(key) ?? 0) > 1) { plan.skipped.push({ ...base, reason: 'same_day' }); continue }
    const holes = holesByKey.get(key) ?? []
    if (holes.length === 0) { plan.skipped.push({ ...base, reason: 'no_holes' }); continue }

    plan.rounds.push({
      ...base,
      tee_color: r['tee name'] ? r['tee name']!.toLowerCase() : null,
      holes: holes.map((h) => {
        const score = int(h['total strokes']) ?? 0
        const rows = (shotsByHole.get(`${key}|${h['hole number']}`) ?? [])
          .slice()
          .sort((a, b) => (int(a['shot number']) ?? 0) - (int(b['shot number']) ?? 0))
        // Shots are kept only when they account for every stroke, numbered 1..n: SG books a hole's
        // last row as holed, so unlogged putts would inflate it.
        const addsUp = rows.length === score && rows.every((s, i) => int(s['shot number']) === i + 1)
        const fairway = h['fairway']
        return {
          number: int(h['hole number']) ?? 0,
          par: int(h['hole par']) ?? 4,
          score,
          putts: int(h['putts']),
          penalties: int(h['penalties']) ?? 0,
          fairway_hit: fairway === 'hit' ? true : fairway === 'left' || fairway === 'right' ? false : null,
          gir: h['GIR'] === 'GIR' ? true : null,
          shots_dropped: rows.length > 0 && !addsUp,
          shots: addsUp
            ? rows.map((s) => {
                const lie = LIES[s['lie'] ?? ''] ?? null
                const yards = int(s['target distance before'])
                return {
                  shot_number: int(s['shot number'])!,
                  lie_type: lie,
                  club: club(s['club'] ?? ''),
                  distance_to_target: yards,
                  putt_distance_ft: lie === 'green' && yards != null ? yards * 3 : null,
                  penalty: s['outcome'] === 'Penalty',
                }
              })
            : [],
        }
      }),
    })
  }
  return plan
}
