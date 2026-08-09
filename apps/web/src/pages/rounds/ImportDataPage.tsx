import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  summarizeImportDataQuality,
  validateImportPayload,
  type ImportDataQualityIssue,
  type ImportRoundPayload,
} from '../../lib/import'
import { CourseSearch } from '../../components/courses/CourseSearch'
import { TeeSelector } from '../../components/courses/TeeSelector'
import { useAuth } from '../../hooks/useAuth'
import { useCreateRound, useDeleteRound } from '../../hooks/useRounds'
import { useUpsertHoleScore } from '../../hooks/useHoleScores'
import { useCreateShot } from '../../hooks/useShots'
import { useHolesForCourse } from '../../hooks/useCourses'
import { supabase } from '../../lib/supabase'
import { toUserMessage } from '../../lib/errors'

type Step = 'input' | 'review'

// "Import from data" lets you pre-populate a round from a JSON payload you
// produce yourself — e.g. a Garmin-to-OGA converter script you write and
// run outside this app. Field names in the payload are this app's actual
// snake_case DB columns (see ../../lib/import.ts), so the payload
// is both the input format and a preview of what gets inserted. Fields no
// external source can know (shot shape, lie slope, break direction, green
// speed, ...) are simply absent from the payload and get filled in on the
// normal scorecard/shot-entry screens after import.
export function ImportDataPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createRound = useCreateRound()
  const deleteRound = useDeleteRound()
  const upsertHoleScore = useUpsertHoleScore(undefined)
  const createShot = useCreateShot(undefined)

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

  const holesQuery = useHolesForCourse(courseId ?? undefined)

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

  // Most crawler-imported courses have no `holes` rows at all — only the
  // ones OSM actually mapped. hole_scores.hole_id has an FK to holes.id, so
  // without materializing a real row first, every hole on a typical course
  // would get silently skipped and this would create an empty round.
  // Mirrors the insert_synthetic_hole RPC call in useRoundActions.ts's
  // ensureRealHole (migration 0026) — that version lives inside a hook tied
  // to an already-loaded round's state, so it's re-inlined here rather than
  // reused directly.
  async function resolveHoleId(
    roundId: string,
    holesByNumber: Map<number, { id: string }>,
    number: number,
  ): Promise<string> {
    const holeRow = holesByNumber.get(number)
    if (holeRow) return holeRow.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase) as (
      fn: 'insert_synthetic_hole',
      args: { p_course_id: string; p_number: number; p_par: number; p_round_id: string },
    ) => Promise<{ data: string | null; error: { message: string } | null }>
    const { data: holeId, error } = await rpc('insert_synthetic_hole', {
      p_course_id: courseId!,
      p_number: number,
      p_par: 4,
      p_round_id: roundId,
    })
    if (error || !holeId) {
      throw new Error(error?.message ?? 'insert_synthetic_hole returned no id')
    }
    return holeId
  }

  async function handleImport() {
    if (!user || !payload || !courseId) return
    setBusy(true)
    setError(null)

    let roundRow: { id: string } | null = null
    try {
      setProgress('Creating round…')
      roundRow = await createRound.mutateAsync({
        user_id: user.id,
        course_id: courseId,
        course_tee_id: courseTeeId,
        played_at: payload.played_at,
        tee_color: payload.tee_color ?? teeColor,
        total_score: payload.total_score ?? null,
        total_putts: payload.total_putts ?? null,
        import_id: payload.import_id ?? null,
      })
      if (!roundRow) throw new Error('Round insert returned no row')

      const holesByNumber = new Map((holesQuery.data ?? []).map((h) => [h.number, h]))

      for (const hole of payload.holes) {
        setProgress(`Saving hole ${hole.number} of ${payload.holes.length}…`)
        const holeId = await resolveHoleId(roundRow.id, holesByNumber, hole.number)
        const savedHoleScore = await upsertHoleScore.mutateAsync({
          round_id: roundRow.id,
          hole_id: holeId,
          score: hole.score,
          putts: hole.putts ?? null,
          penalties: hole.penalties ?? 0,
          fairway_hit: hole.fairway_hit ?? null,
          gir: hole.gir ?? null,
          pin_lat: hole.pin_lat ?? null,
          pin_lng: hole.pin_lng ?? null,
        })
        if (!savedHoleScore) continue
        for (const shot of hole.shots) {
          await createShot.mutateAsync({
            hole_score_id: savedHoleScore.id,
            user_id: user.id,
            shot_number: shot.shot_number,
            club: shot.club ?? null,
            lie_type: shot.lie_type ?? null,
            lie_slope_forward: shot.lie_slope_forward ?? null,
            lie_slope_side: shot.lie_slope_side ?? null,
            shot_result: shot.shot_result ?? null,
            start_lat: shot.start_lat ?? null,
            start_lng: shot.start_lng ?? null,
            end_lat: shot.end_lat ?? null,
            end_lng: shot.end_lng ?? null,
            aim_lat: shot.aim_lat ?? null,
            aim_lng: shot.aim_lng ?? null,
            distance_to_target: shot.distance_to_target ?? null,
            penalty: shot.penalty ?? false,
            ob: shot.ob ?? false,
            aim_offset_yards: shot.aim_offset_yards ?? null,
            break_direction_vertical: shot.break_direction_vertical ?? null,
            break_direction_horizontal: shot.break_direction_horizontal ?? null,
            putt_distance_ft: shot.putt_distance_ft ?? null,
            putt_distance_result: shot.putt_distance_result ?? null,
            putt_direction_result: shot.putt_direction_result ?? null,
            putt_slope_pct: shot.putt_slope_pct ?? null,
            green_speed: shot.green_speed ?? null,
            notes: shot.notes ?? null,
          })
        }
      }

      navigate(`/rounds/${roundRow.id}`)
    } catch (err) {
      // Partial imports leave an orphaned round (and consume import_id) —
      // delete it so a retry after fixing the payload isn't blocked by a
      // half-written round from this attempt. Best-effort: if the rollback
      // itself fails, at least log it rather than swallowing it — the
      // import_id is already consumed at that point, so a silent failure
      // here means a retry would just say "already imported" with no way
      // back short of manual cleanup.
      if (roundRow) {
        try {
          await deleteRound.mutateAsync(roundRow.id)
        } catch (rollbackErr) {
          console.error('Failed to roll back partially-imported round', roundRow.id, rollbackErr)
        }
      }
      setError(toUserMessage(err))
      setBusy(false)
      setProgress('')
    }
  }

  const shotCount = payload?.holes.reduce((n, h) => n + h.shots.length, 0) ?? 0

  return (
    <div className="mx-auto max-w-2xl">
      <div style={{ marginBottom: 18 }}>
        <h1 className="text-caddie-ink" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}>
          Import from data
        </h1>
        <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 2 }}>
          Paste or upload a JSON payload to pre-populate a round — fill in shot shape, lie
          slope, and other detail your data source doesn't track once it lands on the
          scorecard.
        </div>
      </div>

      <div
        className="bg-caddie-surface flex flex-col gap-5"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 10, padding: 20 }}
      >
        {step === 'input' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <FieldLabel>JSON payload</FieldLabel>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-caddie-accent"
                style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600 }}
              >
                Upload file…
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
              className="w-full bg-caddie-surface-2 text-caddie-ink"
              style={{
                border: '0.5px solid #E4E4E0',
                borderRadius: 7,
                padding: '10px 12px',
                fontSize: 12,
                fontFamily: 'monospace',
                minHeight: 260,
                resize: 'vertical',
              }}
            />

            {rawText.trim().length === 0 && (
              <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
                Waiting for a payload — see apps/web/src/lib/import.ts for the expected shape.
              </div>
            )}

            {validation && !validation.success && (
              <div
                className="text-caddie-neg"
                style={{
                  fontSize: 12,
                  border: '1px solid #E4A0A0',
                  borderRadius: 7,
                  padding: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {validation.errors.length} problem{validation.errors.length === 1 ? '' : 's'}
                </div>
                {validation.errors.map((err, idx) => (
                  <div key={idx} style={{ marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace' }}>{err.path}</span>: {err.message}
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
                <div className="text-caddie-warn" style={{ fontSize: 12 }}>
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
                      {dataQuality.missingLieType.length === 1 ? '' : 's'} missing lie_type:{' '}
                      {formatIssueLocations(dataQuality.missingLieType)}.
                    </div>
                  )}
                  {dataQuality.missingDistanceToTarget.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      {dataQuality.missingDistanceToTarget.length} non-putt shot
                      {dataQuality.missingDistanceToTarget.length === 1 ? '' : 's'} missing
                      distance_to_target: {formatIssueLocations(dataQuality.missingDistanceToTarget)}.
                    </div>
                  )}
                  {dataQuality.misplacedPuttDistance.length > 0 && (
                    <div>
                      {dataQuality.misplacedPuttDistance.length} putt
                      {dataQuality.misplacedPuttDistance.length === 1 ? '' : 's'} carry their distance
                      in distance_to_target instead of putt_distance_ft — putting Strokes Gained will
                      read as 0 for these: {formatIssueLocations(dataQuality.misplacedPuttDistance)}.
                    </div>
                  )}
                </div>
              )}

            {error && (
              <div className="text-caddie-neg" style={{ fontSize: 13 }}>
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleContinue}
                disabled={busy || !validation?.success}
                className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
                style={buttonStyle}
              >
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'review' && payload && (
          <div className="flex flex-col gap-5">
            {alreadyImported && (
              <div
                className="text-caddie-neg"
                style={{ fontSize: 13, border: '1px solid #E4A0A0', borderRadius: 7, padding: 10 }}
              >
                A round with import_id "{payload.import_id}" already exists. Importing again will
                create a duplicate round — go back and remove/change import_id if that's not what
                you want.
              </div>
            )}

            <div>
              <FieldLabel>
                Course{payload.course_name ? ` (payload says "${payload.course_name}")` : ''}
              </FieldLabel>
              <CourseSearch
                selectedCourseId={courseId}
                initialQuery={payload.course_name ?? ''}
                onSelect={(id, name) => {
                  setCourseId(id)
                  setCourseName(name)
                  setCourseTeeId(null)
                }}
              />
              {courseName && courseId && (
                <p className="text-caddie-accent" style={{ fontSize: 13, marginTop: 8 }}>
                  Selected: {courseName}
                </p>
              )}
            </div>

            {courseId && (
              <div>
                <FieldLabel>Tee</FieldLabel>
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

            <div>
              <FieldLabel>What's coming in</FieldLabel>
              <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                {payload.played_at} · {payload.total_score ?? '?'} strokes over{' '}
                {payload.holes.length} holes, {shotCount} shots.
              </div>
            </div>

            {error && (
              <div className="text-caddie-neg" style={{ fontSize: 13 }}>
                {error}
              </div>
            )}

            {busy && progress && (
              <div className="text-caddie-ink-dim" style={{ fontSize: 13 }}>
                {progress}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={busy}
                className="bg-caddie-surface text-caddie-ink transition-colors hover:bg-caddie-surface-2 disabled:opacity-50"
                style={{ ...buttonStyle, background: 'transparent', border: '0.5px solid #E4E4E0' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={busy || !courseId || holesQuery.isLoading}
                className="bg-caddie-accent text-caddie-accent-ink disabled:opacity-50"
                style={buttonStyle}
              >
                {busy ? 'Importing…' : 'Import round'}
              </button>
            </div>
          </div>
        )}
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
    <div
      className="text-caddie-ink-dim uppercase"
      style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.4, marginBottom: 6 }}
    >
      {children}
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 500,
}
