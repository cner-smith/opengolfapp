import { useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DEFAULT_HANDICAP,
  isProbableSameCourse,
  readGolfPadExport,
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
  same_day: 'same course twice that day, and the rounds couldn’t be told apart',
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

// Golf Pad writes Windows-1252.
async function readExport(files: FileList) {
  const decoder = new TextDecoder('windows-1252')
  return readGolfPadExport(await Promise.all(Array.from(files, async (f) => decoder.decode(await f.arrayBuffer()))))
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
      const read = await readExport(files)
      // Shown as written: toUserMessage hides every message outside dev builds.
      if ('rejected' in read) {
        setPlan(null)
        setRows([])
        setError(read.rejected)
        e.target.value = ''
        return
      }
      const p = read.plan
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
    <div className="flex flex-col" style={{ gap: 22 }}>
      <ol className="text-caddie-ink" style={{ fontSize: 15, lineHeight: 1.55, paddingLeft: 0, listStyle: 'none' }}>
        {[
          'In Golf Pad, open Settings → Data Export and ask for the comprehensive export (Premium).',
          'Golf Pad emails you a download link.',
          'Choose all three CSV files from it here: rounds, holes and shots.',
        ].map((step, i) => (
          <li key={i} className="flex" style={{ gap: 12, padding: '10px 0', borderBottom: LINE_RULE }}>
            <span className="font-serif text-caddie-ink-dim tabular" style={{ fontSize: 17, minWidth: 14 }}>
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div>
        <label
          className="inline-flex items-center text-caddie-ink hover:bg-caddie-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
          style={{
            border: '1px solid #9F9580',
            borderRadius: 2,
            padding: '11px 16px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.02em',
            cursor: progress ? 'not-allowed' : 'pointer',
            opacity: progress ? 0.5 : 1,
          }}
        >
          {plan ? 'Choose different files' : 'Choose the CSV files'}
          <input
            type="file"
            multiple
            accept=".csv,text/csv"
            aria-label="Golf Pad export files"
            onChange={handleFiles}
            disabled={!!progress}
            className="sr-only"
          />
        </label>
      </div>

      {error && (
        <p className="text-caddie-neg" role="alert" style={{ fontSize: 13 }}>
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <div>
          <h2 className="font-serif text-caddie-ink" style={h2Style}>
            Your courses
          </h2>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, margin: '8px 0 4px' }}>
            Confirm each one. Rounds on a skipped course stay out.
          </p>
          {rows.map((row) => (
            <section
              key={row.golfPadName}
              aria-label={row.golfPadName}
              style={{ borderBottom: LINE_RULE, padding: '14px 4px' }}
            >
              <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 500 }}>
                {row.golfPadName}{' '}
                <span className="text-caddie-ink-mute" style={{ fontWeight: 400 }}>
                  · {row.rounds} round{row.rounds === 1 ? '' : 's'}
                </span>
              </div>
              <div
                className={row.decision && row.decision !== 'skip' ? 'text-caddie-ink' : 'text-caddie-ink-dim'}
                style={{ fontSize: 13, marginTop: 4 }}
              >
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
                <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 10 }}>
                  {row.match && !row.decision && (
                    <button
                      type="button"
                      onClick={() => updateRow(row.golfPadName, { decision: { courseId: row.match!.id, courseName: row.match!.name } })}
                      className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90"
                      style={{ ...buttonStyle, border: '1px solid #1F3D2C' }}
                    >
                      Use this course
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateRow(row.golfPadName, { choosing: !row.choosing })}
                    aria-expanded={row.choosing}
                    className="text-caddie-ink hover:bg-caddie-surface"
                    style={{ ...buttonStyle, background: 'transparent', border: '1px solid #9F9580' }}
                  >
                    {row.match || row.decision ? 'Choose a different course' : 'Choose a course'}
                  </button>
                  {row.decision !== 'skip' && (
                    <button
                      type="button"
                      onClick={() => updateRow(row.golfPadName, { decision: 'skip', choosing: false })}
                      className="text-caddie-ink-dim hover:text-caddie-ink"
                      style={{ ...buttonStyle, background: 'transparent', border: '1px solid transparent' }}
                    >
                      Skip
                    </button>
                  )}
                </div>
              )}
              {row.choosing && (
                <div style={{ marginTop: 12 }}>
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

      {progress && (
        <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
          {progress}
        </div>
      )}

      {pendingScoresOnly.total > 0 && (
        <section aria-label="Scores only" style={{ fontSize: 13, borderLeft: '2px solid #A66A1F', paddingLeft: 14 }}>
          <div className="text-caddie-warn" style={{ fontSize: 15, fontWeight: 500 }}>
            {holesText(pendingHoles.length - pendingScoresOnly.total)} with shots,{' '}
            {holesText(pendingScoresOnly.total)} with scores only
          </div>
          <div className="text-caddie-ink-dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
            A hole’s shots come in only when they account for every stroke; otherwise its strokes
            gained would be wrong. Score, putts, penalties, fairway and green still count.
          </div>
          <ul className="text-caddie-ink-dim" style={{ marginTop: 6, paddingLeft: 18, listStyle: 'disc' }}>
            {pendingScoresOnly.reasons.map(([why, n]) => (
              <li key={why}>
                {n} · {why}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center" style={{ gap: '10px 14px' }}>
          <button
            type="button"
            onClick={handleImport}
            disabled={!decided || toImport === 0 || !!progress}
            className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-50"
            style={{ ...buttonStyle, border: 'none', padding: '12px 16px', fontSize: 14, letterSpacing: '0.02em' }}
          >
            Import {toImport} round{toImport === 1 ? '' : 's'}
          </button>
          {!decided && (
            <span className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
              Confirm or skip every course first.
            </span>
          )}
        </div>
      )}

      {result && (
        <div style={{ fontSize: 13 }}>
          <h2 className="font-serif text-caddie-ink" style={h2Style}>
            Imported {result.imported.length} round{result.imported.length === 1 ? '' : 's'}
          </h2>
          {result.imported.map((r, i) => (
            <div key={i} className="text-caddie-ink" style={{ padding: '10px 4px', borderBottom: LINE_RULE }}>
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
            <div style={{ marginTop: 18 }}>
              <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                Not imported
              </div>
              {result.notImported.map((n, i) => (
                <div key={i} className="text-caddie-ink-dim" style={{ padding: '10px 4px', borderBottom: LINE_RULE }}>
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

const LINE_RULE = '1px solid #D9D2BF'

const h2Style: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 500,
  fontStyle: 'italic',
  lineHeight: 1.2,
  paddingBottom: 8,
  borderBottom: LINE_RULE,
}

const buttonStyle: React.CSSProperties = {
  borderRadius: 2,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
}
