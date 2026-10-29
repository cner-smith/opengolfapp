import { useState, type ChangeEvent } from 'react'
import { readScorecardCsv, SCORECARD_CSV_TEMPLATE, type ScorecardCsvPlan } from '@oga/core'
import { CourseConfirmImport, LINE_RULE, h2Style } from './CourseConfirmImport'
import { toUserMessage } from '../../../lib/errors'
import { FileDrop } from '../../../components/ui/FileDrop'

// A plain scorecard CSV (#1192): one row per round from a spreadsheet or another app's scorecards.
// Scores only; every line that can't be read is listed by number before anything is imported.

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([SCORECARD_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'oga-scorecard-template.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ScorecardCsvImport() {
  const [plan, setPlan] = useState<ScorecardCsvPlan | null>(null)
  const [fileName, setFileName] = useState('')
  const [pick, setPick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) await readFile(e.target.files)
    e.target.value = ''
  }

  async function readFile(files: FileList) {
    const file = files[0]!
    setError(null)
    try {
      // Non-fatal decode: bytes that aren't UTF-8 become U+FFFD, which the reader turns away.
      const read = readScorecardCsv(new TextDecoder('utf-8').decode(await file.arrayBuffer()))
      // Shown as written: toUserMessage hides every message outside dev builds.
      if ('rejected' in read) {
        setPlan(null)
        setError(read.rejected)
      } else {
        setPlan(read.plan)
        setFileName(file.name)
        setPick((n) => n + 1)
      }
    } catch (err) {
      setError(toUserMessage(err))
    }
  }

  const found = plan?.rounds.length ?? 0
  const problems = plan?.problems ?? []

  return (
    <div className="flex flex-col" style={{ gap: 22 }}>
      <ol className="text-caddie-ink" style={{ fontSize: 15, lineHeight: 1.55, paddingLeft: 0, listStyle: 'none' }}>
        <Step n={1}>
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-caddie-ink underline underline-offset-4 hover:opacity-80"
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            Download the template
          </button>
          : a header row and two example rounds.
        </Step>
        <Step n={2}>
          One row per round: the date (YYYY-MM-DD), the course, the tee if you like, and each hole’s
          score. Leave holes 10–18 empty for nine holes, and delete the two example rows.
        </Step>
        <Step n={3}>Save it as CSV (UTF-8) and choose it here.</Step>
      </ol>
      <div>
        <label
          className="key key-primary focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
          aria-disabled={busy}
          style={{ cursor: busy ? 'default' : 'pointer' }}
        >
          {plan ? 'Choose a different file' : 'Choose the CSV file'}{' '}
          <span className="font-serif" style={{ fontStyle: 'italic' }}>→</span>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Scorecard CSV file"
            onChange={handleFile}
            disabled={busy}
            className="sr-only"
          />
        </label>
      </div>
      <FileDrop label="Or drop the CSV file here" accept=".csv,text/csv" disabled={busy} onFiles={readFile} />

      {error && (
        <p className="text-caddie-neg" role="alert" style={{ fontSize: 13 }}>
          {error}
        </p>
      )}

      {plan && (
        <section aria-label="What the file holds">
          <h2 className="font-serif text-caddie-ink" style={h2Style}>
            {found} round{found === 1 ? '' : 's'} found
          </h2>
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            From {fileName}. Scores only: no putts, fairways or shots.
          </p>
          {problems.length > 0 && (
            <section
              aria-label="Lines not imported"
              style={{ fontSize: 13, borderLeft: '2px solid #A66A1F', paddingLeft: 14, marginTop: 14 }}
            >
              <div className="text-caddie-warn" style={{ fontSize: 15, fontWeight: 500 }}>
                {problems.length} line{problems.length === 1 ? '' : 's'} won’t be imported
              </div>
              <div className="text-caddie-ink-dim" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Nothing on {problems.length === 1 ? 'it' : 'them'} is guessed. Fix the file and choose it
                again, or import the rest now.
              </div>
              <ul className="text-caddie-ink" style={{ marginTop: 6, padding: 0, listStyle: 'none' }}>
                {problems.map((p) => (
                  <li key={p.line} style={{ padding: '6px 0', borderBottom: LINE_RULE, lineHeight: 1.45 }}>
                    <span className="tabular" style={{ fontWeight: 600 }}>
                      Line {p.line}
                    </span>
                    <span className="text-caddie-ink-dim"> · {p.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}

      {plan && found > 0 && <CourseConfirmImport key={pick} rounds={plan.rounds} notImported={[]} onBusyChange={setBusy} />}
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex" style={{ gap: 12, padding: '10px 0', borderBottom: LINE_RULE }}>
      <span className="font-serif text-caddie-ink-dim tabular" style={{ fontSize: 17, minWidth: 14 }}>
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}
