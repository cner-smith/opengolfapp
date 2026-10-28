import { useState, type ChangeEvent } from 'react'
import {
  readGolfPadExport,
  type GolfPadHole,
  type GolfPadPlan,
  type GolfPadScoresOnlyReason,
  type GolfPadSkipReason,
} from '@oga/core'
import { CourseConfirmImport, LINE_RULE } from './CourseConfirmImport'
import { toUserMessage } from '../../../lib/errors'
import { FileDrop } from '../../../components/ui/FileDrop'

// Golf Pad's "comprehensive" export (#1134): three CSVs → every round, one course confirm per
// Golf Pad course name, SG at import.

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
  const [plan, setPlan] = useState<GolfPadPlan | null>(null)
  const [pick, setPick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) await readFiles(e.target.files)
    e.target.value = ''
  }

  async function readFiles(files: FileList) {
    setError(null)
    try {
      const read = await readExport(files)
      // Shown as written: toUserMessage hides every message outside dev builds.
      if ('rejected' in read) {
        setPlan(null)
        setError(read.rejected)
      } else {
        setPlan(read.plan)
        setPick((n) => n + 1)
      }
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

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
          className="key key-primary focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
          aria-disabled={busy}
          style={{ cursor: busy ? 'default' : 'pointer' }}
        >
          {plan ? 'Choose different files' : 'Choose the three files'}{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
          <input
            type="file"
            multiple
            accept=".csv,text/csv"
            aria-label="Golf Pad export files"
            onChange={handleFiles}
            disabled={busy}
            className="sr-only"
          />
        </label>
      </div>
      <FileDrop label="Or drop rounds, holes and shots here" disabled={busy} onFiles={readFiles} />

      {error && (
        <p className="text-caddie-neg" role="alert" style={{ fontSize: 13 }}>
          {error}
        </p>
      )}

      {plan && (
        <CourseConfirmImport
          key={pick}
          rounds={plan.rounds}
          notImported={plan.skipped.map((s) => ({ courseName: s.course_name, playedAt: s.played_at, why: SKIP_WHY[s.reason] }))}
          onBusyChange={setBusy}
          notice={(pending) => <ScoresOnlyWarning holes={pending.flatMap((r) => r.holes)} />}
          importedNote={(round) => {
            const so = scoresOnlyCounts(round.holes)
            return (
              so.total > 0 && (
                <span className="text-caddie-warn">
                  {' '}· {holesText(so.total)} scores only (
                  {so.reasons.map(([why, n]) => (so.reasons.length > 1 ? `${n} ${why}` : why)).join(', ')})
                </span>
              )
            )
          }}
        />
      )}
    </div>
  )
}

function ScoresOnlyWarning({ holes }: { holes: GolfPadHole[] }) {
  const so = scoresOnlyCounts(holes)
  if (so.total === 0) return null
  return (
    <section aria-label="Scores only" style={{ fontSize: 13, borderLeft: '2px solid #A66A1F', paddingLeft: 14 }}>
      <div className="text-caddie-warn" style={{ fontSize: 15, fontWeight: 500 }}>
        {holesText(holes.length - so.total)} with shots, {holesText(so.total)} with scores only
      </div>
      <div className="text-caddie-ink-dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
        A hole’s shots come in only when they account for every stroke; otherwise its strokes
        gained would be wrong. Score, putts, penalties, fairway and green still count.
      </div>
      <ul className="text-caddie-ink-dim" style={{ marginTop: 6, paddingLeft: 18, listStyle: 'disc' }}>
        {so.reasons.map(([why, n]) => (
          <li key={why}>
            {n} · {why}
          </li>
        ))}
      </ul>
    </section>
  )
}
