import { useEffect, useMemo, useState } from 'react'
import {
  CLUBS,
  LIE_TYPES,
  SHOT_RESULTS,
  type Club,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
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
import { GreenDiagram, type BreakDirection } from '../round/GreenDiagram'

const BREAK_OPTIONS: { value: BreakDirection; label: string }[] = [
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

type PuttResult = 'made' | 'short' | 'long' | 'missed_left' | 'missed_right'

type GreenSpeed = 'slow' | 'medium' | 'fast'

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
  puttResult?: PuttResult
  puttSlopePct?: number
  greenSpeed?: GreenSpeed
  breakDirection?:
    | 'left_to_right'
    | 'right_to_left'
    | 'uphill'
    | 'downhill'
    | 'straight'
  aimOffsetInches?: number
  notes?: string
}

// Map a legacy single-axis lie_slope value onto the two new axes so existing
// rows stay editable after the split.
function legacySlopeToAxes(
  legacy: ShotRow['lie_slope'],
): { forward?: LieSlopeForward; side?: LieSlopeSide } {
  if (legacy === 'uphill' || legacy === 'level' || legacy === 'downhill') {
    return { forward: legacy }
  }
  if (legacy === 'ball_above' || legacy === 'ball_below') {
    return { side: legacy }
  }
  return {}
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
    puttResult: s.putt_result ?? undefined,
    puttSlopePct: s.putt_slope_pct ?? undefined,
    greenSpeed: s.green_speed ?? undefined,
    breakDirection: 'straight',
    aimOffsetInches: 0,
    notes: s.notes ?? undefined,
  }
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

  useEffect(() => {
    if (editing) return
    setDraft(emptyDraft(holeShots.length + 1, holeShots.length === 0))
  }, [holeShots.length, editing])

  function startEdit(s: ShotRow) {
    setEditing(s.id)
    setDraft(shotRowToDraft(s))
  }

  function cancelEdit() {
    setEditing(null)
    setDraft(emptyDraft(holeShots.length + 1, holeShots.length === 0))
  }

  async function save(overrideResult?: PuttResult) {
    if (!user) return
    const isPuttSave = draft.lieType === 'green'
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
      putt_result: overrideResult ?? draft.puttResult ?? null,
      putt_slope_pct: draft.puttSlopePct ?? null,
      green_speed: draft.greenSpeed ?? null,
      penalty: draft.shotResult === 'penalty',
      ob: draft.shotResult === 'ob',
      notes: draft.notes ?? null,
    }
    if (editing) {
      await updateShot.mutateAsync({ id: editing, updates: insert })
    } else {
      await createShot.mutateAsync(insert)
    }
    cancelEdit()
  }

  async function remove(id: string) {
    if (!confirm('Delete this shot?')) return
    await deleteShot.mutateAsync(id)
    if (editing === id) cancelEdit()
  }

  const isPutt = draft.lieType === 'green'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-caddie-ink/60 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden bg-caddie-surface"
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
                        {s.lie_type ? ` · ${s.lie_type}` : ''}
                      </div>
                      <div
                        className="text-caddie-ink-dim"
                        style={{ fontSize: 12, marginTop: 2 }}
                      >
                        {s.shot_result ?? 'no result'}
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
                <Field label="Distance to target (yards)">
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
                  <Field label="Result">
                    <PuttResultGrid
                      value={draft.puttResult}
                      onChange={(v) => setDraft((d) => ({ ...d, puttResult: v }))}
                    />
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
                    onClick={() => save('missed_left')}
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
                    onClick={() => save('made')}
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

type PuttSelectKey = PuttResult | 'spacer'

const PUTT_GRID: PuttSelectKey[] = [
  'made',
  'short',
  'long',
  'missed_left',
  'spacer',
  'missed_right',
]

function gridButtonStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '12px 8px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
  }
}

function PuttResultGrid({
  value,
  onChange,
}: {
  value: PuttResult | undefined
  onChange: (v: PuttResult | undefined) => void
}) {
  return (
    <div className="grid grid-cols-3" style={{ gap: 6, maxWidth: 360 }}>
      {PUTT_GRID.map((key, i) =>
        key === 'spacer' ? (
          <div key={`s${i}`} />
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onChange(value === key ? undefined : key)}
            style={gridButtonStyle(value === key)}
          >
            {key.replace('_', ' ')}
          </button>
        ),
      )}
    </div>
  )
}
