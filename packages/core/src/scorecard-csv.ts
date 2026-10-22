// A plain scorecard CSV (one row per round: date, course, tee, holes 1–18, total) → rounds ready to
// import, scores only (#1192). Same planned-round shape as the Golf Pad import, so the web reuses its
// course confirm and write path. Nothing is guessed: a row that can't be read exactly is reported by
// line and left out; the rest import.

import { csvRecords, type GolfPadHole, type GolfPadRound } from './golfpad-import'

export interface ScorecardCsvProblem {
  line: number
  reason: string
}

export interface ScorecardCsvPlan {
  rounds: GolfPadRound[]
  problems: ScorecardCsvProblem[]
}

export type ScorecardCsvRead = { plan: ScorecardCsvPlan } | { rejected: string }

const EXAMPLE_COURSE = 'Example Golf Club'

// Two example rounds (18 holes, then 9) on a course no one plays, so rows left in by mistake are
// reported, not imported.
export const SCORECARD_CSV_TEMPLATE = [
  'date,course,tee,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,total',
  `2025-06-14,${EXAMPLE_COURSE} - delete this row,white,5,4,3,4,6,4,5,3,4,4,5,4,3,5,4,4,3,5,75`,
  `2025-06-21,${EXAMPLE_COURSE} - delete this row,,5,5,4,3,6,4,5,4,5,,,,,,,,,,41`,
  '',
].join('\n')

type Column = 'date' | 'course' | 'tee' | 'total' | number

const POSITIONAL: Column[] = ['date', 'course', 'tee', ...Array.from({ length: 18 }, (_, i) => i + 1), 'total']

function columnOf(name: string): Column | null {
  const n = name.trim().toLowerCase()
  if (n === 'date' || n === 'course' || n === 'tee' || n === 'total') return n
  const hole = /^(?:hole\s*|h)?(\d{1,2})$/.exec(n)
  const num = hole ? Number(hole[1]) : 0
  return num >= 1 && num <= 18 ? num : null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function iso(y: number, m: number, d: number): string | null {
  // A day or month past the end rolls into another month.
  if (new Date(Date.UTC(y, m - 1, d)).getUTCMonth() !== m - 1) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// YYYY-MM-DD; M/D/YYYY or D/M/YYYY only when one of the two numbers can't be a month.
function readDate(s: string): { date: string } | { reason: string } {
  if (!s) return { reason: 'no date' }
  const notReal = { reason: `date “${s}” isn’t a real date` }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (ymd) {
    const date = iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
    return date ? { date } : notReal
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (!slash) return { reason: `date “${s}” isn’t YYYY-MM-DD` }
  const [a, b, y] = [Number(slash[1]), Number(slash[2]), Number(slash[3])]
  if (a !== b && a <= 12 && b <= 12) {
    return { reason: `date “${s}” could be ${a} ${MONTHS[b - 1]} or ${b} ${MONTHS[a - 1]}: write it as YYYY-MM-DD` }
  }
  const date = a > 12 ? iso(y, b, a) : iso(y, a, b)
  return date ? { date } : notReal
}

const SCORE = /^[1-9]\d*$/
const MAX_SCORE = 20

// Case, spacing and punctuation don't make a different course: "Pine Ridge" = "pine ridge.".
const courseKey = (name: string) =>
  name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

const holeList = (ns: number[]) => `hole${ns.length === 1 ? '' : 's'} ${ns.join(', ')}`

interface Candidate {
  line: number
  round: GolfPadRound
  key: string
  /** Same value = the same round written twice. */
  same: string
}

type Cells = Partial<Record<Column, string>>

function readRow(line: number, c: Cells): Candidate | { reason: string } {
  const reasons: string[] = []
  const date = readDate(c.date ?? '')
  if ('reason' in date) reasons.push(date.reason)
  const course = (c.course ?? '').replace(/\s+/g, ' ')
  if (!course) reasons.push('no course name')
  else if (course.toLowerCase().startsWith(EXAMPLE_COURSE.toLowerCase())) {
    return { reason: 'an example row from the template: replace it with your own rounds' }
  }

  const holes: GolfPadHole[] = []
  const filled: number[] = []
  for (let n = 1; n <= 18; n++) {
    const cell = c[n] ?? ''
    if (!cell) continue
    filled.push(n)
    const score = SCORE.test(cell) ? Number(cell) : 0
    if (score < 1 || score > MAX_SCORE) {
      reasons.push(`hole ${n}: “${cell}” isn’t a score (a whole number from 1 to ${MAX_SCORE})`)
      continue
    }
    holes.push({ number: n, par: null, score, putts: null, penalties: 0, fairway_hit: null, gir: null, shots: [], scores_only: 'no_shots' })
  }
  // A round is the front nine, the back nine or all eighteen.
  if (filled.length === 0) reasons.push('no hole scores')
  else {
    const from = filled[0]! <= 9 ? 1 : 10
    const to = filled[filled.length - 1]! >= 10 ? 18 : 9
    const missing = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((n) => !filled.includes(n))
    if (missing.length) reasons.push(`no score for ${holeList(missing)}`)
  }

  const total = c.total ?? ''
  if (total && !/^\d+$/.test(total)) reasons.push(`total “${total}” isn’t a number`)
  else if (total && holes.length === filled.length) {
    const sum = holes.reduce((t, h) => t + h.score, 0)
    if (Number(total) !== sum) reasons.push(`total ${Number(total)} doesn’t match the hole scores, which add up to ${sum}`)
  }

  if (reasons.length || 'reason' in date) return { reason: reasons.join('; ') }
  const tee = c.tee ? c.tee.toLowerCase() : null
  const key = `${date.date}:${courseKey(course)}`
  return {
    line,
    key,
    same: JSON.stringify([tee, holes.map((h) => [h.number, h.score])]),
    round: { import_id: `scorecard:${key}`, course_name: course, played_at: date.date, tee_color: tee, holes },
  }
}

// The decoded file text → the plan, or why the file can't be read at all.
export function readScorecardCsv(text: string): ScorecardCsvRead {
  // The decoder writes U+FFFD for bytes that aren't UTF-8 (Excel's plain "CSV" is Windows-1252).
  if (text.includes('\uFFFD')) {
    return { rejected: 'This file isn’t UTF-8 text. In Excel, save it as “CSV UTF-8 (Comma delimited)”.' }
  }
  // trim() also drops a UTF-8 BOM.
  const records = csvRecords(text)
    .map((r) => ({ ...r, cells: r.cells.map((f) => f.trim()) }))
    .filter((r) => r.cells.some((f) => f !== ''))
  const first = records[0]
  if (!first) return { rejected: 'This file is empty.' }
  if (first.cells.length === 1 && first.cells[0]!.includes(';')) {
    return { rejected: 'This file separates its columns with semicolons. Save it with commas (CSV), or start from the template.' }
  }

  let columns = POSITIONAL
  let body = records
  // A header names the date column somewhere; a round starts with its date.
  if (first.cells.some((f) => f.toLowerCase() === 'date')) {
    const named = first.cells.map(columnOf)
    const unknown = first.cells.filter((_, i) => named[i] == null)
    if (unknown.length) {
      return { rejected: `The header has a column the template doesn’t: ${unknown.map((u) => `“${u}”`).join(', ')}. Remove it or start from the template.` }
    }
    const twice = first.cells.find((_, i) => named.indexOf(named[i]!) !== i)
    if (twice) return { rejected: `The header has the “${twice}” column twice.` }
    if (!named.includes('course')) return { rejected: 'The header has no “course” column.' }
    if (!named.some((n) => typeof n === 'number')) return { rejected: 'The header has no hole columns (1 to 18).' }
    columns = named as Column[]
    body = records.slice(1)
    if (body.length === 0) return { rejected: 'This file has a header but no rounds.' }
  } else if (!/^\d/.test(first.cells[0]!)) {
    return {
      rejected:
        'The first row should be the template’s header (date, course, tee, 1 to 18, total) or a round that starts with its date.',
    }
  }

  const problems: ScorecardCsvProblem[] = []
  const candidates: Candidate[] = []
  for (const r of body) {
    if (r.unclosed) { problems.push({ line: r.line, reason: 'a quote mark is never closed' }); continue }
    if (r.cells.slice(columns.length).some((f) => f !== '')) {
      problems.push({ line: r.line, reason: 'more cells than columns: put a course name with a comma in "quotes"' })
      continue
    }
    const cells: Cells = Object.fromEntries(columns.map((col, i) => [col, r.cells[i] ?? '']))
    const read = readRow(r.line, cells)
    if ('reason' in read) problems.push({ line: r.line, reason: read.reason })
    else candidates.push(read)
  }

  // One round per date and course (the import id): a row written twice imports once; rows that
  // differ can't be told apart, so neither is imported.
  const rounds: GolfPadRound[] = []
  const byKey = new Map<string, Candidate[]>()
  for (const c of candidates) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c])
  for (const c of candidates) {
    const group = byKey.get(c.key)!
    if (group.every((g) => g.same === group[0]!.same)) {
      if (c === group[0]) rounds.push(c.round)
      else problems.push({ line: c.line, reason: `a repeat of line ${group[0]!.line} (same date, course and scores): imported once` })
      continue
    }
    const others = group.filter((g) => g !== c).map((g) => g.line)
    problems.push({
      line: c.line,
      reason: `same date and course as another row, with different scores: remove one; neither is imported (line${others.length === 1 ? '' : 's'} ${others.join(', ')})`,
    })
  }
  problems.sort((a, b) => a.line - b.line)
  return { plan: { rounds, problems } }
}
