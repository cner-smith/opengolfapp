import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEFAULT_HANDICAP, isProbableSameCourse, type GolfPadRound } from '@oga/core'
import { deleteRound, searchCourses } from '@oga/supabase'
import { CourseSearch } from '../../../components/courses/CourseSearch'
import { useAuth } from '../../../hooks/useAuth'
import { useProfile } from '../../../hooks/useProfile'
import { completeRound } from '../../../hooks/useCompleteRound'
import { validateImportPayload, writeImportedRound } from '../../../lib/import'
import { supabase } from '../../../lib/supabase'
import { toUserMessage } from '../../../lib/errors'

// The second half of every file import (Golf Pad, scorecard CSV): one confirm row per course name in
// the file (use the match / choose / skip), then write each round and work out its SG. Mount it with
// a new key for each file pick so a slow search from an earlier pick can't fill new rows.

interface CourseRow {
  fileName: string
  rounds: number
  match: { id: string; name: string; place: string } | null
  /** Why there's no match: several courses share the name, or the search failed. */
  noMatchWhy: string | null
  searching: boolean
  choosing: boolean
  decision: { courseId: string; courseName: string } | 'skip' | null
}

export interface NotImported {
  courseName: string
  playedAt: string
  why: string
}

interface Imported {
  courseName: string
  playedAt: string
  round: GolfPadRound
}

interface Props {
  rounds: GolfPadRound[]
  /** Rounds the file reader already left out; listed under "Not imported" after the import. */
  notImported: NotImported[]
  /** Shown above the Import button, given the rounds not on a skipped course. */
  notice?: (pending: GolfPadRound[]) => ReactNode
  /** Follows an imported round in the result. */
  importedNote?: (round: GolfPadRound) => ReactNode
  /** True while rounds are being written, so the file picker can wait. */
  onBusyChange: (busy: boolean) => void
}

export function CourseConfirmImport({ rounds, notImported: leftOut, notice, importedNote, onBusyChange }: Props) {
  const { user } = useAuth()
  const profile = useProfile()
  const qc = useQueryClient()
  const [rows, setRows] = useState<CourseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ imported: Imported[]; notImported: NotImported[] } | null>(null)

  const updateRow = (name: string, patch: Partial<CourseRow>) =>
    setRows((rs) => rs.map((r) => (r.fileName === name ? { ...r, ...patch } : r)))

  useEffect(() => onBusyChange(!!progress), [progress, onBusyChange])

  useEffect(() => {
    let live = true
    const counts = new Map<string, number>()
    for (const r of rounds) counts.set(r.course_name, (counts.get(r.course_name) ?? 0) + 1)
    const names = [...counts.entries()].sort((a, b) => b[1] - a[1])
    setRows(names.map(([fileName, n]) => ({ fileName, rounds: n, match: null, noMatchWhy: null, searching: true, choosing: false, decision: null })))
    // Pre-fill a row only when exactly one course has the same name; the player still confirms
    // every row.
    for (const [name] of names) {
      void searchCourses(supabase, name).then(({ data, error: searchError }) => {
        if (!live) return
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
      })
    }
    return () => { live = false }
  }, [rounds])

  async function handleImport() {
    if (!user) return
    setError(null)
    const notImported: NotImported[] = [...leftOut]
    const decisions = new Map(rows.map((r) => [r.fileName, r.decision]))
    const already = new Set<string | null>()
    const ids = rounds.map((r) => r.import_id)
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
    for (const [i, round] of rounds.entries()) {
      const decision = decisions.get(round.course_name)
      const skip = (why: string) => notImported.push({ courseName: round.course_name, playedAt: round.played_at, why })
      if (!decision || decision === 'skip') { skip('course skipped'); continue }
      if (already.has(round.import_id)) { skip('already imported'); continue }
      const valid = validateImportPayload(round)
      if (!valid.success) { skip(`unreadable data (${valid.errors[0]!.path}: ${valid.errors[0]!.message})`); continue }
      setProgress(`Importing round ${i + 1} of ${rounds.length}…`)
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
        imported.push({ courseName: decision.courseName, playedAt: round.played_at, round })
      } catch (err) {
        // A round whose SG step failed is removed too, so a retry imports it rather than calling
        // it already imported.
        if (roundId) await deleteRound(supabase, roundId, user.id)
        skip(`failed: ${toUserMessage(err)}`)
      }
    }
    setProgress('')
    setRows([])
    setResult({ imported, notImported })
    for (const key of ['rounds', 'detailed-stats', 'sg']) qc.invalidateQueries({ queryKey: [key] })
    qc.invalidateQueries({ queryKey: ['profile', user.id] })
  }

  const decided = rows.length > 0 && rows.every((r) => r.decision)
  const chosen = new Set(rows.filter((r) => r.decision && r.decision !== 'skip').map((r) => r.fileName))
  const toImport = rounds.filter((r) => chosen.has(r.course_name)).length
  // Before Import: every round not on a skipped course.
  const skippedNames = new Set(rows.filter((r) => r.decision === 'skip').map((r) => r.fileName))
  const pending = rounds.filter((r) => !skippedNames.has(r.course_name))

  return (
    <>
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
              key={row.fileName}
              aria-label={row.fileName}
              style={{ borderBottom: LINE_RULE, padding: '14px 4px' }}
            >
              <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 500 }}>
                {row.fileName}{' '}
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
                      onClick={() => updateRow(row.fileName, { decision: { courseId: row.match!.id, courseName: row.match!.name } })}
                      className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90"
                      style={{ ...buttonStyle, border: '1px solid #1F3D2C' }}
                    >
                      Use this course
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateRow(row.fileName, { choosing: !row.choosing })}
                    aria-expanded={row.choosing}
                    className="text-caddie-ink hover:bg-caddie-surface"
                    style={{ ...buttonStyle, background: 'transparent', border: '1px solid #9F9580' }}
                  >
                    {row.match || row.decision ? 'Choose a different course' : 'Choose a course'}
                  </button>
                  {row.decision !== 'skip' && (
                    <button
                      type="button"
                      onClick={() => updateRow(row.fileName, { decision: 'skip', choosing: false })}
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
                    initialQuery={row.fileName}
                    onSelect={(courseId, courseName) =>
                      updateRow(row.fileName, { decision: { courseId, courseName }, choosing: false })
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

      {rows.length > 0 && notice?.(pending)}

      {error && (
        <p className="text-caddie-neg" role="alert" style={{ fontSize: 13 }}>
          {error}
        </p>
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
              {importedNote?.(r.round)}
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
    </>
  )
}

export const LINE_RULE = '1px solid #D9D2BF'

export const h2Style: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 500,
  fontStyle: 'italic',
  lineHeight: 1.2,
  paddingBottom: 8,
  borderBottom: LINE_RULE,
}

export const buttonStyle: React.CSSProperties = {
  borderRadius: 2,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
}
