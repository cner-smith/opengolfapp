import { useState, type ChangeEvent } from 'react'
import {
  golfPadFileKind,
  readGolfPadExport,
  type GolfPadFileKind,
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

// Golf Pad writes Windows-1252. Also says which of the three files each pick was, for the ledger.
async function readExport(files: File[]) {
  const decoder = new TextDecoder('windows-1252')
  const picked = await Promise.all(files.map(async (f) => ({ name: f.name, text: decoder.decode(await f.arrayBuffer()) })))
  const got: Got = {}
  for (const f of picked) {
    const kind = golfPadFileKind(f.text)
    if (kind) got[kind] = f.name
  }
  return { got, read: readGolfPadExport(picked.map((f) => f.text)) }
}

type Got = Partial<Record<GolfPadFileKind, string>>

export function GolfPadImport() {
  const [plan, setPlan] = useState<GolfPadPlan | null>(null)
  const [pick, setPick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState<Got | null>(null)

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) await readFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  async function readFiles(files: File[]) {
    setError(null)
    try {
      const { got, read } = await readExport(files)
      setGot(got)
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
          'Choose all three CSV files from it here:',
        ].map((step, i) => (
          <li key={i} className="flex" style={{ gap: 12, padding: i < 2 ? '10px 0' : '10px 0 14px', borderBottom: LINE_RULE }}>
            <span className="font-serif text-caddie-ink-dim tabular" style={{ fontSize: 17, minWidth: 14 }}>
              {i + 1}
            </span>
            <span className="flex flex-col" style={{ gap: 10, minWidth: 0, flex: 1 }}>
              <span>{step}</span>
              {i === 2 && <FileLedger got={got} />}
            </span>
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
      <FileDrop label="Or drop rounds, holes and shots here" accept=".csv,text/csv" multiple disabled={busy} onFiles={readFiles} />

      {error && !partialPick(got) && (
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

const LEDGER: GolfPadFileKind[] = ['rounds', 'holes', 'shots']

// Some of the three files but not all: the ledger says which are missing.
// A rounds file alone keeps core's line, which names the rounds-only export.
const partialPick = (got: Got | null) =>
  !!got && !!(got.holes || got.shots) && LEDGER.some((k) => !got[k])

// The three files the export needs, as slots that stamp in as each one is
// picked or dropped, so the requirement is visible before any error.
function FileLedger({ got }: { got: Got | null }) {
  const missing = LEDGER.filter((k) => !got?.[k])
  return (
    <div style={{ width: '100%' }}>
      <ul className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Files">
        {LEDGER.map((k, i) => {
          const name = got?.[k]
          return (
            <li
              key={k}
              className="flex items-center text-left"
              style={{
                gap: 10,
                minHeight: 52,
                padding: '8px 12px',
                border: name ? '1px solid #1C211C' : '1px dashed #9F9580',
                borderRadius: 3,
                background: name ? '#FBF8F1' : 'transparent',
              }}
            >
              <span aria-hidden style={{ width: 16, height: 16, flexShrink: 0 }}>
                {name && (
                  <svg key={name} className="ledger-stamp" style={{ animationDelay: `${i * 60}ms` }} width="16" height="16" viewBox="0 0 16 16">
                    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="#1C211C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span style={{ minWidth: 0, fontStyle: 'normal' }}>
                <span className="block" style={{ fontFamily: 'var(--caddie-mono)', fontSize: 15, color: name ? '#1C211C' : '#8A8B7E' }}>
                  {k}.csv
                </span>
                <span className="block text-caddie-ink-dim" style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name ?? 'Not chosen yet'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {partialPick(got) && (
        <p className="text-caddie-neg text-left" role="alert" style={{ fontFamily: 'Epilogue, sans-serif', fontStyle: 'normal', fontSize: 13, marginTop: 8 }}>
          Still need {missing.map((k) => `${k}.csv`).join(' and ')}. Choose all three together.
        </p>
      )}
    </div>
  )
}
