import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CLUBS,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  PUTT_RESULT_LABELS,
  SHOT_RESULTS,
  SHOT_RESULT_LABELS,
  combinedPuttResult,
  legacySlopeToAxes,
  type BreakDirection,
  type Club,
  type GreenSpeed,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ShotResult,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import {
  useCreateShot,
  useDeleteShot,
  useShotsForRound,
  useUpdateShot,
} from '../../hooks/useShots'
import { useAuth } from '../../hooks/useAuth'
import { LieSlopeGrid } from '../forms/LieSlopeGrid'
import { GreenDiagram } from '../round/GreenDiagram'
import { useUnits } from '../../hooks/useUnits'

const BREAK_OPTIONS: {
  value: Exclude<BreakDirection, 'left' | 'right'>
  label: string
}[] = [
  { value: 'left_to_right', label: 'L → R' },
  { value: 'straight', label: 'Straight' },
  { value: 'right_to_left', label: 'R → L' },
  { value: 'uphill', label: 'Uphill' },
  { value: 'downhill', label: 'Downhill' },
]

const SLOPE_INTENSITY_LABELS = ['Flat', 'Slight', 'Moderate', 'Strong', 'Severe']

const GREEN_SPEEDS: { value: GreenSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

type ShotInsert = Database['public']['Tables']['shots']['Insert']
type ShotRow = Database['public']['Tables']['shots']['Row']

interface ShotEntryModalProps {
  roundId: string
  holeScoreId: string
  holeNumber: number
  holePar: number
  onClose: () => void
}

interface DraftShot {
  id?: string
  shotNumber: number
  club?: Club
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  shotResult?: ShotResult
  distanceToTarget?: number
  puttDistanceFt?: number
  puttMade?: boolean
  puttDistanceResult?: PuttDistanceResult
  puttDirectionResult?: PuttDirectionResult
  puttSlopePct?: number
  greenSpeed?: GreenSpeed
  breakDirection?: Exclude<BreakDirection, 'left' | 'right'>
  aimOffsetInches?: number
  notes?: string
}

function shotRowToDraft(s: ShotRow): DraftShot {
  let shotResult: ShotResult | undefined = (s.shot_result as ShotResult | null) ?? undefined
  if (!shotResult && s.ob) shotResult = 'ob'
  else if (!shotResult && s.penalty) shotResult = 'penalty'
  const legacy = legacySlopeToAxes(s.lie_slope)
  return {
    id: s.id,
    shotNumber: s.shot_number,
    club: (s.club as Club | null) ?? undefined,
    lieType: s.lie_type ?? undefined,
    lieSlopeForward: s.lie_slope_forward ?? legacy.forward,
    lieSlopeSide: s.lie_slope_side ?? legacy.side,
    shotResult,
    distanceToTarget: s.distance_to_target ?? undefined,
    puttDistanceFt: s.putt_distance_ft ?? undefined,
    puttMade: s.putt_result === 'made' ? true : undefined,
    puttDistanceResult:
      s.putt_distance_result ??
      (s.putt_result === 'short'
        ? 'short'
        : s.putt_result === 'long'
          ? 'long'
          : undefined),
    puttDirectionResult:
      s.putt_direction_result ??
      (s.putt_result === 'missed_left'
        ? 'left'
        : s.putt_result === 'missed_right'
          ? 'right'
          : undefined),
    puttSlopePct: s.putt_slope_pct ?? undefined,
    greenSpeed: s.green_speed ?? undefined,
    breakDirection: mapBreakDirection(s.break_direction),
    aimOffsetInches:
      s.aim_offset_yards != null ? Math.round(s.aim_offset_yards * 36) : 0,
    notes: s.notes ?? undefined,
  }
}

function mapBreakDirection(
  v: ShotRow['break_direction'],
): DraftShot['breakDirection'] {
  if (
    v === 'left_to_right' ||
    v === 'right_to_left' ||
    v === 'uphill' ||
    v === 'downhill' ||
    v === 'straight'
  ) {
    return v
  }
  // Legacy left/right values map onto the new break-from→to vocabulary.
  if (v === 'left') return 'right_to_left'
  if (v === 'right') return 'left_to_right'
  return 'straight'
}

function emptyDraft(shotNumber: number, isFirstShot: boolean): DraftShot {
  return {
    shotNumber,
    lieType: isFirstShot ? 'tee' : undefined,
    lieSlopeForward: 'level',
  }
}

export function ShotEntryModal({
  roundId,
  holeScoreId,
  holeNumber,
  holePar,
  onClose,
}: ShotEntryModalProps) {
  const { user } = useAuth()
  const units = useUnits()
  const shotsQuery = useShotsForRound(roundId)
  const createShot = useCreateShot(roundId)
  const updateShot = useUpdateShot(roundId)
  const deleteShot = useDeleteShot(roundId)

  const holeShots = useMemo(() => {
    return (shotsQuery.data ?? [])
      .filter((s) => s.hole_score_id === holeScoreId)
      .sort((a, b) => a.shot_number - b.shot_number)
  }, [shotsQuery.data, holeScoreId])

  const [draft, setDraft] = useState<DraftShot>(() =>
    emptyDraft(holeShots.length + 1, holeShots.length === 0),
  )
  const [editing, setEditing] = useState<string | null>(null)

  // Read the latest holeShots count via ref so the reset effect doesn't
  // need it as a dep — a refetch ticking the count up shouldn't wipe the
  // draft the user is filling in. cancelEdit() handles the post-save reset
  // explicitly with the up-to-date length.
  const holeShotsRef = useRef(holeShots)
  holeShotsRef.current = holeShots

  useEffect(() => {
    if (editing) return
    const len = holeShotsRef.current.length
    setDraft(emptyDraft(len + 1, len === 0))
  }, [holeScoreId, editing])

  function startEdit(s: ShotRow) {
    setEditing(s.id)
    setDraft(shotRowToDraft(s))
  }

  function cancelEdit() {
    setEditing(null)
    setDraft(emptyDraft(holeShots.length + 1, holeShots.length === 0))
  }

  async function save(opts?: { madeOverride?: boolean }) {
    if (!user) return
    const isPuttSave = draft.lieType === 'green'
    const made =
      opts?.madeOverride === true
        ? true
        : opts?.madeOverride === false
          ? false
          : draft.puttMade
    const distanceResult = made ? null : draft.puttDistanceResult ?? null
    const directionResult = made ? null : draft.puttDirectionResult ?? null
    const legacyPuttResult = isPuttSave
      ? combinedPuttResult({
          made,
          distance: distanceResult,
          direction: directionResult,
        })
      : null
    const insert: ShotInsert = {
      hole_score_id: holeScoreId,
      user_id: user.id,
      shot_number: draft.shotNumber,
      club: isPuttSave ? 'putter' : draft.club ?? null,
      lie_type: draft.lieType ?? null,
      lie_slope: null,
      // Slope grid is hidden in putting mode — clear both axes.
      lie_slope_forward: isPuttSave ? null : draft.lieSlopeForward ?? null,
      lie_slope_side: isPuttSave ? null : draft.lieSlopeSide ?? null,
      shot_result: isPuttSave ? null : draft.shotResult ?? null,
      distance_to_target: isPuttSave ? null : draft.distanceToTarget ?? null,
      putt_distance_ft: draft.puttDistanceFt ?? null,
      putt_result: legacyPuttResult,
      putt_distance_result: isPuttSave ? distanceResult : null,
      putt_direction_result: isPuttSave ? directionResult : null,
      putt_slope_pct: draft.puttSlopePct ?? null,
      green_speed: draft.greenSpeed ?? null,
      break_direction: isPuttSave ? draft.breakDirection ?? null : null,
      aim_offset_yards:
        isPuttSave && draft.aimOffsetInches != null
          ? Math.round((draft.aimOffsetInches / 36) * 10) / 10
          : null,
      penalty: draft.shotResult === 'penalty',
      ob: draft.shotResult === 'ob',
      notes: draft.notes ?? null,
    }
    try {
      if (editing) {
        await updateShot.mutateAsync({ id: editing, updates: insert })
      } else {
        await createShot.mutateAsync(insert)
      }
      cancelEdit()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('shot save failed', err, insert)
      throw err
    }
  }

  function setPuttMade(made: boolean) {
    setDraft((d) => ({
      ...d,
      puttMade: made,
      puttDistanceResult: made ? undefined : d.puttDistanceResult,
      puttDirectionResult: made ? undefined : d.puttDirectionResult,
    }))
  }

  function setPuttDistanceResult(v: 'short' | 'long') {
    setDraft((d) => ({
      ...d,
      puttMade: false,
      puttDistanceResult: d.puttDistanceResult === v ? undefined : v,
    }))
  }

  function setPuttDirectionResult(v: 'left' | 'right') {
    setDraft((d) => ({
      ...d,
      puttMade: false,
      puttDirectionResult: d.puttDirectionResult === v ? undefined : v,
    }))
  }

  async function remove(id: string) {
    if (!confirm('Delete this shot?')) return
    await deleteShot.mutateAsync(id)
    if (editing === id) cancelEdit()
  }

  const isPutt = draft.lieType === 'green'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-caddie-ink/60 sm:p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden bg-caddie-surface"
        style={{ border: '1px solid #9F9580', borderRadius: 4 }}
      >
        <header
          className="flex items-center justify-between"
          style={{
            borderBottom: '1px solid #D9D2BF',
            padding: '18px 22px',
          }}
        >
          <div>
            <div className="kicker" style={{ marginBottom: 4 }}>
              Hole {holeNumber} · Par {holePar}
            </div>
            <div
              className="font-serif text-caddie-ink"
              style={{
                fontSize: 22,
                fontWeight: 500,
                fontStyle: 'italic',
                lineHeight: 1.1,
              }}
            >
              Shots
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              padding: '6px 10px',
            }}
          >
            Close
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[260px_1fr]">
          <section
            style={{
              borderRight: '1px solid #D9D2BF',
              padding: 18,
            }}
          >
            <div className="kicker" style={{ marginBottom: 12 }}>
              Logged shots
            </div>
            {holeShots.length === 0 && (
              <div
                className="text-caddie-ink-mute"
                style={{
                  border: '1px dashed #D9D2BF',
                  borderRadius: 2,
                  padding: 14,
                  fontSize: 13,
                }}
              >
                No shots logged yet.
              </div>
            )}
            <ul>
              {holeShots.map((s, i) => {
                const isEditing = editing === s.id
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid #D9D2BF',
                      padding: '12px 0',
                      backgroundColor: isEditing ? '#EBE5D6' : 'transparent',
                    }}
                  >
                    <div>
                      <div
                        className="font-mono uppercase tabular text-caddie-ink-mute"
                        style={{ fontSize: 10, letterSpacing: '0.14em' }}
                      >
                        Shot {s.shot_number}
                      </div>
                      <div
                        className="font-serif text-caddie-ink"
                        style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}
                      >
                        {s.club ?? '—'}
                        {s.lie_type
                          ? ` · ${LIE_TYPE_LABELS[s.lie_type as LieType] ?? s.lie_type}`
                          : ''}
                      </div>
                      <div
                        className="text-caddie-ink-dim"
                        style={{ fontSize: 12, marginTop: 2 }}
                      >
                        {formatShotSummary(s)}
                      </div>
                    </div>
                    <div className="flex" style={{ gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="font-mono uppercase text-caddie-ink-mute hover:text-caddie-ink"
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.14em',
                          padding: '4px 8px',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s.id)}
                        className="font-mono uppercase text-caddie-neg"
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.14em',
                          padding: '4px 8px',
                        }}
                      >
                        Del
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section style={{ padding: 22 }} className="flex flex-col" >
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 18 }}
            >
              <div className="kicker">
                {editing ? `Edit shot ${draft.shotNumber}` : `Add shot ${draft.shotNumber}`}
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="font-mono uppercase text-caddie-ink-mute hover:underline"
                  style={{ fontSize: 10, letterSpacing: '0.14em' }}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="flex flex-col" style={{ gap: 18 }}>
              {isPutt && (
                <GreenDiagram
                  distanceFt={draft.puttDistanceFt ?? 0}
                  aimOffsetInches={draft.aimOffsetInches ?? 0}
                  breakDirection={draft.breakDirection ?? 'straight'}
                  onAimChange={(n) =>
                    setDraft((d) => ({ ...d, aimOffsetInches: n }))
                  }
                />
              )}

              {!isPutt && (
                <Field label="Club">
                  <ChipGroup
                    value={draft.club}
                    options={CLUBS}
                    onChange={(v) => setDraft((d) => ({ ...d, club: v }))}
                  />
                </Field>
              )}

              <Field label="Lie type">
                <ChipGroup
                  value={draft.lieType}
                  options={LIE_TYPES}
                  onChange={(v) => setDraft((d) => ({ ...d, lieType: v }))}
                />
              </Field>

              {!isPutt && (
                <Field label="Lie slope">
                  <LieSlopeGrid
                    forward={draft.lieSlopeForward}
                    side={draft.lieSlopeSide}
                    onChangeForward={(v) =>
                      setDraft((d) => ({ ...d, lieSlopeForward: v }))
                    }
                    onChangeSide={(v) =>
                      setDraft((d) => ({ ...d, lieSlopeSide: v }))
                    }
                    toggleable
                  />
                </Field>
              )}

              {!isPutt && (
                <Field
                  label={
                    units.unit === 'meters'
                      ? 'Distance to target (metres)'
                      : 'Distance to target (yards)'
                  }
                >
                  <NumericInput
                    value={draft.distanceToTarget}
                    onChange={(n) =>
                      setDraft((d) => ({ ...d, distanceToTarget: n }))
                    }
                  />
                </Field>
              )}

              {isPutt && (
                <>
                  <Field label="Made?">
                    <div className="flex" style={{ gap: 8 }}>
                      <PuttResultButton
                        label="Holed it"
                        active={draft.puttMade === true}
                        onClick={() => setPuttMade(draft.puttMade !== true)}
                      />
                      <div style={{ flex: 2 }} />
                    </div>
                  </Field>
                  <Field label="Distance">
                    <div className="flex" style={{ gap: 8 }}>
                      <PuttResultButton
                        label="Short"
                        active={
                          !draft.puttMade && draft.puttDistanceResult === 'short'
                        }
                        disabled={draft.puttMade === true}
                        onClick={() => setPuttDistanceResult('short')}
                      />
                      <PuttResultButton
                        label="Long"
                        active={
                          !draft.puttMade && draft.puttDistanceResult === 'long'
                        }
                        disabled={draft.puttMade === true}
                        onClick={() => setPuttDistanceResult('long')}
                      />
                      <div style={{ flex: 1 }} />
                    </div>
                    <div
                      className="font-mono uppercase text-caddie-ink-mute"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        marginTop: 8,
                      }}
                    >
                      Tap again to clear · leave blank if pace was right
                    </div>
                  </Field>
                  <Field label="Direction">
                    <div className="flex" style={{ gap: 8 }}>
                      <PuttResultButton
                        label="Missed left"
                        active={
                          !draft.puttMade &&
                          draft.puttDirectionResult === 'left'
                        }
                        disabled={draft.puttMade === true}
                        onClick={() => setPuttDirectionResult('left')}
                      />
                      <PuttResultButton
                        label="Missed right"
                        active={
                          !draft.puttMade &&
                          draft.puttDirectionResult === 'right'
                        }
                        disabled={draft.puttMade === true}
                        onClick={() => setPuttDirectionResult('right')}
                      />
                    </div>
                    <div
                      className="font-mono uppercase text-caddie-ink-mute"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        marginTop: 8,
                      }}
                    >
                      Tap again to clear · leave blank if line was good
                    </div>
                  </Field>
                  <Field label="Break">
                    <div className="flex flex-wrap" style={{ gap: 6 }}>
                      {BREAK_OPTIONS.map((b) => (
                        <button
                          key={b.value}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, breakDirection: b.value }))
                          }
                          style={chipStyle(draft.breakDirection === b.value)}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="How much">
                    <div className="flex flex-wrap" style={{ gap: 6 }}>
                      {SLOPE_INTENSITY_LABELS.map((label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, puttSlopePct: idx }))
                          }
                          style={chipStyle(draft.puttSlopePct === idx)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Speed">
                    <div className="flex" style={{ gap: 6 }}>
                      {GREEN_SPEEDS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, greenSpeed: s.value }))
                          }
                          style={chipStyle(draft.greenSpeed === s.value)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Distance override (ft)">
                    <NumericInput
                      value={draft.puttDistanceFt}
                      step="0.5"
                      onChange={(n) =>
                        setDraft((d) => ({ ...d, puttDistanceFt: n }))
                      }
                    />
                  </Field>
                </>
              )}

              {!isPutt && (
                <Field label="Shot result">
                  <ChipGroup
                    value={draft.shotResult}
                    options={SHOT_RESULTS}
                    onChange={(v) => setDraft((d) => ({ ...d, shotResult: v }))}
                  />
                </Field>
              )}

              <Field label="Notes">
                <input
                  type="text"
                  value={draft.notes ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  className="w-full text-caddie-ink bg-caddie-surface"
                  style={{
                    border: '1px solid #D9D2BF',
                    borderRadius: 2,
                    padding: '8px 10px',
                    fontSize: 14,
                  }}
                />
              </Field>
            </div>

            <div
              className="flex justify-end"
              style={{
                gap: 12,
                marginTop: 22,
                paddingTop: 18,
                borderTop: '1px solid #D9D2BF',
              }}
            >
              <button
                type="button"
                onClick={cancelEdit}
                className="text-caddie-accent hover:opacity-80"
                style={{
                  border: '1px solid #1F3D2C',
                  borderRadius: 2,
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  backgroundColor: 'transparent',
                }}
              >
                Reset
              </button>
              {isPutt ? (
                <>
                  <button
                    type="button"
                    onClick={() => save({ madeOverride: false })}
                    disabled={createShot.isPending || updateShot.isPending}
                    className="text-caddie-accent hover:opacity-80 disabled:opacity-40"
                    style={{
                      border: '1px solid #1F3D2C',
                      borderRadius: 2,
                      padding: '12px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      backgroundColor: 'transparent',
                    }}
                  >
                    Missed{' '}
                    <span className="font-serif" style={{ fontStyle: 'italic' }}>
                      →
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => save({ madeOverride: true })}
                    disabled={createShot.isPending || updateShot.isPending}
                    className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
                    style={{
                      borderRadius: 2,
                      padding: '12px 18px',
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    Holed it{' '}
                    <span className="font-serif" style={{ fontStyle: 'italic' }}>
                      →
                    </span>
                  </button>
                </>
              ) : (
                <button
                type="button"
                onClick={() => save()}
                disabled={createShot.isPending || updateShot.isPending}
                className="bg-caddie-accent text-caddie-accent-ink hover:opacity-90 disabled:opacity-40"
                style={{
                  borderRadius: 2,
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                {editing ? 'Save changes' : 'Add shot'}{' '}
                <span className="font-serif" style={{ fontStyle: 'italic' }}>
                  →
                </span>
              </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// Build the second line on each shot row in the side panel. Putts get
// their putt_result label + distance; everything else gets the
// shot_result label. Falls back to the raw value when the column has
// something unexpected, and to '—' when both are null.
function formatShotSummary(s: ShotRow): string {
  if (s.lie_type === 'green' || s.club === 'putter') {
    const result =
      (s.putt_result &&
        PUTT_RESULT_LABELS[s.putt_result as keyof typeof PUTT_RESULT_LABELS]) ??
      s.putt_result ??
      null
    const distance =
      s.putt_distance_ft != null ? `${Math.round(s.putt_distance_ft)} ft` : null
    const parts = [result, distance].filter(Boolean) as string[]
    return parts.length ? parts.join(' · ') : '—'
  }
  if (s.shot_result) {
    return SHOT_RESULT_LABELS[s.shot_result as ShotResult] ?? s.shot_result
  }
  return '—'
}

function NumericInput({
  value,
  step,
  onChange,
}: {
  value: number | undefined
  step?: string
  onChange: (n: number | undefined) => void
}) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={value ?? ''}
      onChange={(e) =>
        onChange(e.target.value ? Number(e.target.value) : undefined)
      }
      className="font-serif tabular text-caddie-ink bg-caddie-surface"
      style={{
        border: '1px solid #D9D2BF',
        borderRadius: 2,
        padding: '8px 10px',
        fontSize: 17,
        fontWeight: 500,
        width: 140,
      }}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

interface ChipGroupProps<T extends string> {
  value: T | undefined
  options: readonly T[]
  onChange: (v: T | undefined) => void
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
  }
}

function ChipGroup<T extends string>({ value, options, onChange }: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? undefined : opt)}
          style={chipStyle(value === opt)}
        >
          {opt.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  )
}

function PuttResultButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        backgroundColor: active ? '#1F3D2C' : '#FBF8F1',
        color: active ? '#F2EEE5' : '#1C211C',
        border: `1px solid ${active ? '#1F3D2C' : '#D9D2BF'}`,
        borderRadius: 2,
        padding: '14px 10px',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

