import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  summarizeImportDataQuality,
  validateImportPayload,
  type ImportDataQualityIssue,
  type ImportRoundPayload,
  writeImportedRound,
} from '../../lib/import'
import { CourseSearch } from '../../components/courses/CourseSearch'
import { GolfPadImport } from './components/GolfPadImport'
import { ScorecardCsvImport } from './components/ScorecardCsvImport'
import { Choice, ChoiceRow } from './NewRoundPage'
import { TeeSelector } from '../../components/courses/TeeSelector'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'

type Step = 'input' | 'review'

// "Import OGA JSON" lets you pre-populate a round from a JSON payload you
// produce yourself — e.g. a Garmin-to-OGA converter script you write and
// run outside this app. Field names in the payload are this app's actual
// snake_case DB columns (see ../../lib/import.ts), so the payload
// is both the input format and a preview of what gets inserted. Fields no
// external source can know (shot shape, lie slope, break direction, green
// speed, ...) are simply absent from the payload and get filled in on the
// normal scorecard/shot-entry screens after import.
export function ImportDataPage() {
  useDocumentTitle('Import rounds · OGA')
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [mode, setMode] = useState<'json' | 'golfpad' | 'csv'>('golfpad')
  const [step, setStep] = useState<Step>('input')
  const [rawText, setRawText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [payload, setPayload] = useState<ImportRoundPayload | null>(null)
  const [alreadyImported, setAlreadyImported] = useState(false)

  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseTeeId, setCourseTeeId] = useState<string | null>(null)
  const [teeColor, setTeeColor] = useState('white')

  // Live validation on every keystroke/paste — zod parsing a round-sized
  // payload is well under a millisecond, no debounce needed.
  const validation = useMemo(() => {
    if (!rawText.trim()) return null
    return validateImportPayload(rawText)
  }, [rawText])

  // Advisory only — every field it checks is optional in the schema, so
  // this never gates Continue. Lets someone iterating on a converter
  // script (Garmin, etc.) notice dropped fields immediately instead of
  // discovering degraded stats much later.
  const dataQuality = useMemo(() => {
    if (!validation?.success) return null
    return summarizeImportDataQuality(validation.data)
  }, [validation])

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setRawText(String(reader.result ?? ''))
    reader.readAsText(file)
    e.target.value = '' // allow re-selecting the same file after a fix
  }

  async function handleContinue() {
    if (!validation?.success || !user) return
    setError(null)
    setBusy(true)
    try {
      if (validation.data.import_id) {
        const { data: existing } = await supabase
          .from('rounds')
          .select('id')
          .eq('user_id', user.id)
          .eq('import_id', validation.data.import_id)
          .maybeSingle()
        setAlreadyImported(!!existing)
      } else {
        setAlreadyImported(false)
      }
      setPayload(validation.data)
      setCourseId(null)
      setCourseName(validation.data.course_name ?? '')
      setCourseTeeId(null)
      setStep('review')
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!user || !payload || !courseId) return
    setBusy(true)
    setError(null)
    try {
      const roundId = await writeImportedRound(supabase, {
        userId: user.id,
        courseId,
        courseTeeId,
        teeColor,
        payload,
        onProgress: setProgress,
      })
      for (const key of ['rounds', 'detailed-stats', 'sg']) qc.invalidateQueries({ queryKey: [key] })
      navigate(`/rounds/${roundId}`)
    } catch (err) {
      setError(toUserMessage(err))
      setBusy(false)
      setProgress('')
    }
  }

  const shotCount = payload?.holes.reduce((n, h) => n + h.shots.length, 0) ?? 0

  return (
    <div style={{ maxWidth: 680 }}>
      <h1
        className="font-serif text-caddie-ink"
        style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15, marginBottom: 6 }}
      >
        Import rounds
      </h1>
      <p className="text-caddie-ink-dim" style={{ fontSize: 15, marginBottom: 28, maxWidth: 560 }}>
        {mode === 'golfpad'
          ? 'Bring your Golf Pad history across: every round, with strokes gained worked out on import.'
          : mode === 'csv'
            ? 'Bring scores from a spreadsheet or another app’s scorecards: one row per round.'
            : 'Paste or upload an OGA JSON payload to fill in a round. Shot shape, lie slope and anything else your data source doesn’t record can be added on the scorecard afterwards.'}
      </p>

      <div className="flex flex-col" style={{ gap: 22 }}>
        {mode !== 'json' && (
          <ChoiceRow label="What you’re importing">
            <Choice
              active={mode === 'golfpad'}
              onClick={() => setMode('golfpad')}
              title="Golf Pad"
              subtitle="The comprehensive export: rounds, holes and shots."
            />
            <Choice
              active={mode === 'csv'}
              onClick={() => setMode('csv')}
              title="Scorecard CSV"
              subtitle="A spreadsheet of scores, from our template."
            />
          </ChoiceRow>
        )}
        {mode !== 'json' && (
          <p className="text-caddie-ink-dim" style={{ fontSize: 13, lineHeight: 1.5, marginTop: -8 }}>
            More platforms are coming. If one matters to you,{' '}
            <a href={`${GITHUB_REPO}/issues/new`} target="_blank" rel="noreferrer noopener" className="text-caddie-ink underline underline-offset-4 hover:opacity-80">
              open an issue
            </a>{' '}
            or{' '}
            <a href={`${GITHUB_REPO}/discussions`} target="_blank" rel="noreferrer noopener" className="text-caddie-ink underline underline-offset-4 hover:opacity-80">
              start a discussion
            </a>{' '}
            on GitHub.
          </p>
        )}
        {mode === 'golfpad' && <GolfPadImport />}
        {mode === 'csv' && <ScorecardCsvImport />}

        {mode === 'json' && step === 'input' && (
          <div className="flex flex-col" style={{ gap: 14 }}>
            <div className="flex items-baseline justify-between">
              <FieldLabel>JSON payload</FieldLabel>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-caddie-ink underline underline-offset-4 hover:opacity-80"
                style={{ background: 'transparent', border: 'none', fontSize: 13 }}
              >
                Upload a file…
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='{"played_at": "2026-08-01", "holes": [...]}'
              spellCheck={false}
              aria-label="OGA JSON payload"
              className="w-full bg-caddie-surface text-caddie-ink"
              style={{
                border: '1px solid #5C6356',
                borderRadius: 2,
                padding: '10px 12px',
                fontSize: 12,
                fontFamily: 'var(--caddie-mono)',
                minHeight: 260,
                resize: 'vertical',
              }}
            />

            {rawText.trim().length === 0 && (
              <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                Paste a round in OGA’s JSON format, or upload a .json file.
              </div>
            )}

            {validation && !validation.success && (
              <div
                className="text-caddie-neg"
                style={{
                  fontSize: 12,
                  borderLeft: '2px solid #A33A2A',
                  paddingLeft: 12,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {validation.errors.length} problem{validation.errors.length === 1 ? '' : 's'}
                </div>
                {validation.errors.map((err, idx) => (
                  <div key={idx} style={{ marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--caddie-mono)' }}>{err.path}</span>: {err.message}
                  </div>
                ))}
              </div>
            )}

            {validation && validation.success && (
              <div className="text-caddie-accent" style={{ fontSize: 13 }}>
                Looks good — {validation.data.holes.length} hole
                {validation.data.holes.length === 1 ? '' : 's'},{' '}
                {validation.data.holes.reduce((n, h) => n + h.shots.length, 0)} shot(s).
              </div>
            )}

            {dataQuality &&
              (dataQuality.missingClub.length > 0 ||
                dataQuality.missingLieType.length > 0 ||
                dataQuality.missingDistanceToTarget.length > 0 ||
                dataQuality.misplacedPuttDistance.length > 0) && (
                <div className="text-caddie-ink" style={{ fontSize: 13, borderLeft: '2px solid #A66A1F', paddingLeft: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Watch out — some shot details are missing:
                  </div>
                  {dataQuality.missingClub.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      {dataQuality.missingClub.length} shot
                      {dataQuality.missingClub.length === 1 ? '' : 's'} missing club:{' '}
                      {formatIssueLocations(dataQuality.missingClub)}.
                    </div>
                  )}
                  {dataQuality.missingLieType.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      {dataQuality.missingLieType.length} shot
                      {dataQuality.missingLieType.length === 1 ? '' : 's'} missing a lie:{' '}
                      {formatIssueLocations(dataQuality.missingLieType)}.
                    </div>
                  )}
                  {dataQuality.missingDistanceToTarget.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      {dataQuality.missingDistanceToTarget.length} non-putt shot
                      {dataQuality.missingDistanceToTarget.length === 1 ? '' : 's'} missing the
                      distance to the pin: {formatIssueLocations(dataQuality.missingDistanceToTarget)}.
                    </div>
                  )}
                  {dataQuality.misplacedPuttDistance.length > 0 && (
                    <div>
                      {dataQuality.misplacedPuttDistance.length} putt
                      {dataQuality.misplacedPuttDistance.length === 1 ? ' keeps' : 's keep'} the putt length in
                      the wrong field, so putting strokes gained will read 0 for{' '}
                      {dataQuality.misplacedPuttDistance.length === 1 ? 'it' : 'them'}: {formatIssueLocations(dataQuality.misplacedPuttDistance)}.
                    </div>
                  )}
                </div>
              )}

            {error && (
              <p className="text-caddie-neg" role="alert" style={{ fontSize: 13 }}>
                {error}
              </p>
            )}

            <div className="flex">
              <button
                type="button"
                onClick={handleContinue}
                disabled={busy || !validation?.success}
                className="key key-primary"
                style={buttonStyle}
              >
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {mode === 'json' && step === 'review' && payload && (
          <div className="flex flex-col" style={{ gap: 18 }}>
            {alreadyImported && (
              <div
                className="text-caddie-neg"
                role="alert"
                style={{ fontSize: 13, borderLeft: '2px solid #A33A2A', paddingLeft: 12 }}
              >
                A round with import_id "{payload.import_id}" already exists. Importing again will
                create a duplicate round — go back and remove/change import_id if that's not what
                you want.
              </div>
            )}

            <div className="text-caddie-ink" style={{ fontSize: 15, lineHeight: 1.5 }}>
              <span className="font-serif" style={{ fontSize: 18 }}>
                {payload.played_at}
              </span>{' '}
              · {payload.total_score ?? '?'} strokes over {payload.holes.length} holes, {shotCount} shots.
            </div>

            <section aria-label="Course" style={{ borderTop: LINE_RULE, borderBottom: LINE_RULE, paddingBottom: 14 }}>
              <div className="flex items-center justify-between" style={{ gap: 16, minHeight: 52, padding: '12px 4px' }}>
                <span className="text-caddie-ink" style={{ fontSize: 15 }}>
                  Course
                  {payload.course_name && (
                    <span className="text-caddie-ink-dim" style={{ display: 'block', fontSize: 13 }}>
                      The payload says “{payload.course_name}”
                    </span>
                  )}
                </span>
                {courseName && courseId ? (
                  <span className="font-serif text-caddie-ink" style={{ fontSize: 18, textAlign: 'right' }}>
                    {courseName}
                  </span>
                ) : (
                  <span className="text-caddie-ink-dim" style={{ fontSize: 15 }}>
                    Not chosen
                  </span>
                )}
              </div>
              <CourseSearch
                selectedCourseId={courseId}
                initialQuery={payload.course_name ?? ''}
                onSelect={(id, name) => {
                  setCourseId(id)
                  setCourseName(name)
                  setCourseTeeId(null)
                }}
              />
            </section>

            {courseId && (
              <div>
                <FieldLabel>Tee: its rating and slope feed your handicap</FieldLabel>
                <TeeSelector
                  courseId={courseId}
                  selectedTeeId={courseTeeId}
                  onSelect={(id, color) => {
                    setCourseTeeId(id)
                    setTeeColor(color)
                  }}
                />
              </div>
            )}

            {error && (
              <p className="text-caddie-neg" role="alert" style={{ fontSize: 13 }}>
                {error}
              </p>
            )}

            {busy && progress && (
              <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                {progress}
              </div>
            )}

            <div className="flex items-center" style={{ gap: 18 }}>
              <button
                type="button"
                onClick={handleImport}
                disabled={busy || !courseId}
                className="key key-primary"
                style={buttonStyle}
              >
                {busy ? 'Importing…' : 'Import round'}
              </button>
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={busy}
                className="text-caddie-ink-dim hover:text-caddie-ink disabled:opacity-50"
                style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        <div style={{ borderTop: LINE_RULE, paddingTop: 14, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setMode(mode === 'json' ? 'golfpad' : 'json')}
            className="text-caddie-ink-dim hover:text-caddie-ink underline underline-offset-4"
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, cursor: 'pointer' }}
          >
            {mode === 'json' ? 'Import from Golf Pad or a scorecard CSV' : 'Import OGA JSON'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Groups flat (holeNumber, shotNumber) issues by hole for a compact,
// scannable location list, e.g. "hole 3 (shots 2, 3), hole 11 (shot 2)".
function formatIssueLocations(issues: ImportDataQualityIssue[]): string {
  const shotsByHole = new Map<number, number[]>()
  for (const { holeNumber, shotNumber } of issues) {
    const shots = shotsByHole.get(holeNumber) ?? []
    shots.push(shotNumber)
    shotsByHole.set(holeNumber, shots)
  }
  return [...shotsByHole.entries()]
    .map(
      ([holeNumber, shotNumbers]) =>
        `hole ${holeNumber} (shot${shotNumbers.length === 1 ? '' : 's'} ${shotNumbers.join(', ')})`,
    )
    .join(', ')
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 8 }}>
      {children}
    </div>
  )
}

const LINE_RULE = '1px solid #D9D2BF'
const GITHUB_REPO = 'https://github.com/cner-smith/opengolfapp'

const buttonStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '0.02em',
}
