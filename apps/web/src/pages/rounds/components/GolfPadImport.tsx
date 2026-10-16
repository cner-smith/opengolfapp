import { useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DEFAULT_HANDICAP,
  isProbableSameCourse,
  planGolfPadImport,
  type GolfPadHole,
  type GolfPadPlan,
  type GolfPadScoresOnlyReason,
  type GolfPadSkipReason,
} from '@oga/core'
import { deleteRound, searchCourses } from '@oga/supabase'
import { CourseSearch } from '../../../components/courses/CourseSearch'
import { useAuth } from '../../../hooks/useAuth'
import { useProfile } from '../../../hooks/useProfile'
import { completeRound } from '../../../hooks/useCompleteRound'
import { validateImportPayload, writeImportedRound } from '../../../lib/import'
import { supabase } from '../../../lib/supabase'
import { toUserMessage } from '../../../lib/errors'

// Golf Pad's "comprehensive" export (#1134): three CSVs → every round, one course confirm per
// Golf Pad course name, SG at import.

interface CourseRow {
  golfPadName: string
  rounds: number
  match: { id: string; name: string; place: string } | null
  /** Why there's no match: several courses share the name, or the search failed. */
  noMatchWhy: string | null
  searching: boolean
  choosing: boolean
  decision: { courseId: string; courseName: string } | 'skip' | null
}

interface Imported {
  courseName: string
  playedAt: string
  scoresOnly: ScoresOnly
}

interface NotImported {
  courseName: string
  playedAt: string
  why: string
}

const SKIP_WHY: Record<GolfPadSkipReason, string> = {
  same_day: 'same course twice that day',
  no_holes: 'no hole data in the export',
  no_round_id: 'no Golf Pad round id in the export',
}

const SCORES_ONLY_WHY: Record<GolfPadScoresOnlyReason, string> = {
  strokes_missing: 'shots or putts not logged',
  penalty_no_row: 'a penalty stroke not logged as a shot',
  numbers_mismatch: 'shot numbers don’t match the score',
  no_shots: 'no shots logged',
}

interface ScoresOnly {
  total: number
  /** [reason, holes], most common first. */
  reasons: [string, number][]
}

function scoresOnlyCounts(holes: GolfPadHole[]): ScoresOnly {
  const counts = new Map<string, number>()
  for (const h of holes) {
    if (!h.scores_only) continue
    const why = SCORES_ONLY_WHY[h.scores_only]
    counts.set(why, (counts.get(why) ?? 0) + 1)
  }
  const reasons = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return { total: reasons.reduce((n, [, c]) => n + c, 0), reasons }
}

const holesText = (n: number) => `${n} hole${n === 1 ? '' : 's'}`

// Golf Pad writes Windows-1252; the files are told apart by their headers, not their names.
async function readExport(files: FileList) {
  const found: Partial<Record<'rounds' | 'holes' | 'shots', string>> = {}
  for (const file of Array.from(files)) {
    const text = new TextDecoder('windows-1252').decode(await file.arrayBuffer())
    const header = text.slice(0, text.search(/\r?\n/))
    if (header.includes('gross score')) found.rounds = text
    else if (header.includes('total strokes')) found.holes = text
    else if (header.includes('shot number')) found.shots = text
  }
  if (!found.rounds || !found.holes || !found.shots) {
    throw new Error('Choose all three Golf Pad files: rounds, holes and shots.')
  }
  return planGolfPadImport({ rounds: found.rounds, holes: found.holes, shots: found.shots })
}

export function GolfPadImport() {
  const { user } = useAuth()
  const profile = useProfile()
  const qc = useQueryClient()
  // Bumped on every file pick, so a slow course search from an earlier pick can't fill new rows.
  const pickRef = useRef(0)
  const [plan, setPlan] = useState<GolfPadPlan | null>(null)
  const [rows, setRows] = useState<CourseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ imported: Imported[]; notImported: NotImported[] } | null>(null)

  const updateRow = (name: string, patch: Partial<CourseRow>) =>
    setRows((rs) => rs.map((r) => (r.golfPadName === name ? { ...r, ...patch } : r)))

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setError(null)
    setResult(null)
    const pick = ++pickRef.current
    try {
      const p = await readExport(files)
      setPlan(p)
      const counts = new Map<string, number>()
      for (const r of p.rounds) counts.set(r.course_name, (counts.get(r.course_name) ?? 0) + 1)
      const names = [...counts.entries()].sort((a, b) => b[1] - a[1])
      setRows(names.map(([golfPadName, rounds]) => ({ golfPadName, rounds, match: null, noMatchWhy: null, searching: true, choosing: false, decision: null })))
      // Pre-fill a row only when exactly one course has the same name; the player still confirms
      // every row.
      await Promise.all(names.map(async ([name]) => {
        const { data, error: searchError } = await searchCourses(supabase, name)
        if (pick !== pickRef.current) return
        const hits = (data ?? []).filter((c) => isProbableSameCourse({ name }, c))
        const hit = hits.length === 1 ? hits[0]! : null
        updateRow(name, {
          searching: false,
          match: hit ? { id: hit.id, name: hit.name, place: [hit.city, hit.state].filter(Boolean).join(', ') } : null,
          noMatchWhy: searchError
            ? 'Couldn’t search for this course: choose one'
            : hits.length > 1
              ? `${hits.length} courses share this name: choose one`
              : null,
        })
      }))
    } catch (err) {
      setError(toUserMessage(err))
    }
    e.target.value = ''
  }

  async function handleImport() {
    if (!plan || !user) return
    setError(null)
    const notImported: NotImported[] = plan.skipped.map((s) => ({ courseName: s.course_name, playedAt: s.played_at, why: SKIP_WHY[s.reason] }))
    const decisions = new Map(rows.map((r) => [r.golfPadName, r.decision]))
    const already = new Set<string | null>()
    const ids = plan.rounds.map((r) => r.import_id)
    // Chunked: the ids travel in the request URL.
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error: existingError } = await supabase
        .from('rounds')
        .select('import_id')
        .eq('user_id', user.id)
        .in('import_id', ids.slice(i, i + 100))
      if (existingError) { setError(toUserMessage(existingError)); return }
      for (const r of data ?? []) already.add(r.import_id)
    }
    const handicap = profile.data?.handicap_index ?? DEFAULT_HANDICAP
    const imported: Imported[] = []
    for (const [i, round] of plan.rounds.entries()) {
      const decision = decisions.get(round.course_name)
      const skip = (why: string) => notImported.push({ courseName: round.course_name, playedAt: round.played_at, why })
      if (!decision || decision === 'skip') { skip('course skipped'); continue }
      if (already.has(round.import_id)) { skip('already imported'); continue }
      const valid = validateImportPayload(round)
      if (!valid.success) { skip(`unreadable data (${valid.errors[0]!.path}: ${valid.errors[0]!.message})`); continue }
      setProgress(`Importing round ${i + 1} of ${plan.rounds.length}…`)
      const teeColor = round.tee_color ?? 'white'
      let roundId: string | null = null
      try {
        roundId = await writeImportedRound(supabase, {
          userId: user.id,
          courseId: decision.courseId,
          courseTeeId: null,
          teeColor,
          payload: valid.data,
        })
        await completeRound({ roundId, courseId: decision.courseId, handicap, courseTeeId: null, teeColor, userId: user.id })
        imported.push({ courseName: decision.courseName, playedAt: round.played_at, scoresOnly: scoresOnlyCounts(round.holes) })
      } catch (err) {
        // A round whose SG step failed is removed too, so a retry imports it rather than calling
        // it already imported.
        if (roundId) await deleteRound(supabase, roundId, user.id)
        skip(`failed: ${toUserMessage(err)}`)
      }
    }
    setProgress('')
    setPlan(null)
    setRows([])
    setResult({ imported, notImported })
    for (const key of ['rounds', 'detailed-stats', 'sg']) qc.invalidateQueries({ queryKey: [key] })
    qc.invalidateQueries({ queryKey: ['profile', user.id] })
  }

  const decided = rows.length > 0 && rows.every((r) => r.decision)
  const chosen = new Set(rows.filter((r) => r.decision && r.decision !== 'skip').map((r) => r.golfPadName))
  const toImport = plan?.rounds.filter((r) => chosen.has(r.course_name)).length ?? 0
  // Before Import: every round not on a skipped course.
  const skippedNames = new Set(rows.filter((r) => r.decision === 'skip').map((r) => r.golfPadName))
  const pendingHoles = plan?.rounds.filter((r) => !skippedNames.has(r.course_name)).flatMap((r) => r.holes) ?? []
  const pendingScoresOnly = scoresOnlyCounts(pendingHoles)

  return (
    <div className="flex flex-col gap-5">
      <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
        In Golf Pad: Settings → Data Export → the comprehensive export. Choose all three CSV files
        it emails you (rounds, holes and shots).
      </div>
      <input
        type="file"
        multiple
        accept=".csv,text/csv"
        aria-label="Golf Pad export files"
        onChange={handleFiles}
        disabled={!!progress}
      />

      {rows.length > 0 && (
        <div>
          <FieldLabel>Courses — confirm each one</FieldLabel>
          {rows.map((row) => (
            <section
              key={row.golfPadName}
              aria-label={row.golfPadName}
              style={{ borderBottom: '1px solid #E4E4E0', padding: '14px 0' }}
            >
              <div className="text-caddie-ink" style={{ fontSize: 14, fontWeight: 600 }}>
                {row.golfPadName}{' '}
                <span className="text-caddie-ink-mute" style={{ fontWeight: 400 }}>
                  · {row.rounds} round{row.rounds === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 4 }}>
                {row.decision === 'skip'
                  ? 'Skipped: these rounds won’t be imported.'
                  : row.decision
                    ? `Importing to ${row.decision.courseName}.`
                    : row.searching
                      ? 'Looking for this course…'
                      : row.match
                        ? `Match: ${row.match.name}${row.match.place ? ` · ${row.match.place}` : ''}`
                        : (row.noMatchWhy ?? 'No match found')}
              </div>
              {!row.searching && (
                <div className="flex gap-2" style={{ marginTop: 8 }}>
                  {row.match && !row.decision && (
                    <button
                      type="button"
                      onClick={() => updateRow(row.golfPadName, { decision: { courseId: row.match!.id, courseName: row.match!.name } })}
                      className="bg-caddie-accent text-caddie-accent-ink"
                      style={buttonStyle}
                    >
                      Use this course
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateRow(row.golfPadName, { choosing: !row.choosing })}
                    className="text-caddie-accent"
                    style={{ ...buttonStyle, background: 'transparent', border: '1px solid currentColor' }}
                  >
                    {row.match || row.decision ? 'Choose a different course' : 'Choose a course'}
                  </button>
                  {row.decision !== 'skip' && (
                    <button
                      type="button"
                      onClick={() => updateRow(row.golfPadName, { decision: 'skip', choosing: false })}
                      className="text-caddie-ink-dim"
                      style={{ ...buttonStyle, background: 'transparent', border: '1px solid #E4E4E0' }}
                    >
                      Skip
                    </button>
                  )}
                </div>
              )}
              {row.choosing && (
                <div style={{ marginTop: 10 }}>
                  <CourseSearch
                    selectedCourseId={row.decision && row.decision !== 'skip' ? row.decision.courseId : null}
                    initialQuery={row.golfPadName}
                    onSelect={(courseId, courseName) =>
                      updateRow(row.golfPadName, { decision: { courseId, courseName }, choosing: false })
                    }
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {error && (
        <div className="text-caddie-neg" style={{ fontSize: 13 }}>
          {error}
        </div>
      )}
      {progress && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          {progress}
        </div>
      )}

      {pendingScoresOnly.total > 0 && (
        <section aria-label="Scores only" style={{ fontSize: 13 }}>
          <div className="text-caddie-warn" style={{ fontWeight: 600 }}>
            {holesText(pendingHoles.length - pendingScoresOnly.total)} with shots,{' '}
            {holesText(pendingScoresOnly.total)} with scores only
          </div>
          <div className="text-caddie-ink-dim" style={{ marginTop: 4 }}>
            A hole’s shots come in only when they account for every stroke; otherwise its strokes
            gained would be wrong. Score, putts, penalties, fairway and green still count.
          </div>
          <ul className="text-caddie-ink-dim" style={{ marginTop: 4, paddingLeft: 18, listStyle: 'disc' }}>
            {pendingScoresOnly.reasons.map(([why, n]) => (
              <li key={why}>
                {n} · {why}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleImport}
            disabled={!decided || toImport === 0 || !!progress}
            className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
            style={buttonStyle}
          >
            Import {toImport} round{toImport === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-2" style={{ fontSize: 13 }}>
          <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 600 }}>
            Imported {result.imported.length} round{result.imported.length === 1 ? '' : 's'}
          </div>
          {result.imported.map((r, i) => (
            <div key={i} className="text-caddie-ink-dim">
              {r.courseName} · {r.playedAt}
              {r.scoresOnly.total > 0 && (
                <span className="text-caddie-warn">
                  {' '}· {holesText(r.scoresOnly.total)} scores only (
                  {r.scoresOnly.reasons.map(([why, n]) => (r.scoresOnly.reasons.length > 1 ? `${n} ${why}` : why)).join(', ')})
                </span>
              )}
            </div>
          ))}
          {result.notImported.length > 0 && (
            <div>
              <FieldLabel>Not imported</FieldLabel>
              {result.notImported.map((n, i) => (
                <div key={i} className="text-caddie-ink-dim">
                  {n.courseName} · {n.playedAt} — {n.why}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-caddie-ink-dim uppercase"
      style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.4, marginBottom: 6 }}
    >
      {children}
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  borderRadius: 2,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
}
