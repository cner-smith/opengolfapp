import { useEffect, useMemo, useState } from 'react'
import {
  CLUBS,
  LIE_TYPES,
  SHOT_RESULTS,
  type Club,
  type LieSlope,
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

interface DraftShot {
  id?: string
  shotNumber: number
  club?: Club
  lieType?: LieType
  lieSlope?: LieSlope
  shotResult?: ShotResult
  distanceToTarget?: number
  puttDistanceFt?: number
  puttResult?: PuttResult
  notes?: string
}

function shotRowToDraft(s: ShotRow): DraftShot {
  let shotResult: ShotResult | undefined = (s.shot_result as ShotResult | null) ?? undefined
  if (!shotResult && s.ob) shotResult = 'ob'
  else if (!shotResult && s.penalty) shotResult = 'penalty'
  return {
    id: s.id,
    shotNumber: s.shot_number,
    club: (s.club as Club | null) ?? undefined,
    lieType: s.lie_type ?? undefined,
    lieSlope: s.lie_slope ?? undefined,
    shotResult,
    distanceToTarget: s.distance_to_target ?? undefined,
    puttDistanceFt: s.putt_distance_ft ?? undefined,
    puttResult: s.putt_result ?? undefined,
    notes: s.notes ?? undefined,
  }
}

function emptyDraft(shotNumber: number, isFirstShot: boolean): DraftShot {
  return {
    shotNumber,
    lieType: isFirstShot ? 'tee' : undefined,
    lieSlope: 'level',
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

  async function save() {
    if (!user) return
    const insert: ShotInsert = {
      hole_score_id: holeScoreId,
      user_id: user.id,
      shot_number: draft.shotNumber,
      club: draft.club ?? null,
      lie_type: draft.lieType ?? null,
      lie_slope: draft.lieSlope ?? null,
      shot_result: draft.shotResult ?? null,
      distance_to_target: draft.distanceToTarget ?? null,
      putt_distance_ft: draft.puttDistanceFt ?? null,
      putt_result: draft.puttResult ?? null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden bg-oga-bg-card"
        style={{ border: '0.5px solid #E4E4E0', borderRadius: 12 }}
      >
        <header
          className="flex items-center justify-between"
          style={{
            borderBottom: '0.5px solid #E4E4E0',
            padding: '14px 18px',
          }}
        >
          <div>
            <div
              className="font-medium text-oga-text-primary"
              style={{ fontSize: 18 }}
            >
              Shots — Hole {holeNumber}
            </div>
            <div className="text-oga-text-muted" style={{ fontSize: 11 }}>
              Par {holePar}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-oga-text-muted transition-colors hover:text-oga-text-primary"
            style={{ fontSize: 13, padding: '6px 10px' }}
          >
            Close
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[260px_1fr]">
          <section
            style={{
              borderRight: '0.5px solid #E4E4E0',
              padding: 14,
            }}
          >
            <div
              className="text-oga-text-muted uppercase"
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 0.4,
                marginBottom: 8,
              }}
            >
              Shots
            </div>
            {holeShots.length === 0 && (
              <div
                className="text-oga-text-muted"
                style={{
                  border: '0.5px dashed #E4E4E0',
                  borderRadius: 7,
                  padding: 12,
                  fontSize: 12,
                }}
              >
                No shots logged yet.
              </div>
            )}
            <ul className="flex flex-col" style={{ gap: 4 }}>
              {holeShots.map((s) => {
                const isEditing = editing === s.id
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between"
                    style={{
                      backgroundColor: isEditing ? '#E1F5EE' : '#FFFFFF',
                      border: `0.5px solid ${isEditing ? '#1D9E75' : '#E4E4E0'}`,
                      borderRadius: 7,
                      padding: '8px 10px',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div
                        className="font-medium tabular text-oga-text-primary"
                        style={{ fontSize: 12 }}
                      >
                        #{s.shot_number} {s.club ?? '—'}
                        {s.lie_type ? ` · ${s.lie_type}` : ''}
                      </div>
                      <div className="text-oga-text-muted" style={{ fontSize: 11 }}>
                        {s.shot_result ?? 'no result'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="text-oga-text-muted transition-colors hover:text-oga-text-primary"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s.id)}
                        className="text-oga-red transition-colors hover:text-oga-red-dark"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        Del
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section style={{ padding: 18 }} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div
                className="font-medium text-oga-text-primary"
                style={{ fontSize: 14 }}
              >
                {editing ? `Edit shot #${draft.shotNumber}` : `Add shot #${draft.shotNumber}`}
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-oga-text-muted hover:underline"
                  style={{ fontSize: 11 }}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <Field label="Club">
              <ChipGroup
                value={draft.club}
                options={CLUBS}
                onChange={(v) => setDraft((d) => ({ ...d, club: v }))}
              />
            </Field>

            <Field label="Lie type">
              <ChipGroup
                value={draft.lieType}
                options={LIE_TYPES}
                onChange={(v) => setDraft((d) => ({ ...d, lieType: v }))}
              />
            </Field>

            <Field label="Lie slope">
              <LieSlopeGrid
                value={draft.lieSlope}
                onChange={(v) => setDraft((d) => ({ ...d, lieSlope: v }))}
              />
            </Field>

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
                <Field label="Putt distance (ft)">
                  <NumericInput
                    value={draft.puttDistanceFt}
                    step="0.5"
                    onChange={(n) =>
                      setDraft((d) => ({ ...d, puttDistanceFt: n }))
                    }
                  />
                </Field>
                <Field label="Putt result">
                  <PuttResultGrid
                    value={draft.puttResult}
                    onChange={(v) => setDraft((d) => ({ ...d, puttResult: v }))}
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
                className="w-full bg-oga-bg-input text-oga-text-primary"
                style={{
                  border: '0.5px solid #E4E4E0',
                  borderRadius: 7,
                  padding: '7px 10px',
                  fontSize: 13,
                }}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-oga-bg-card text-oga-text-primary transition-colors hover:bg-oga-bg-input"
                style={{
                  border: '0.5px solid #E4E4E0',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={save}
                disabled={createShot.isPending || updateShot.isPending}
                className="bg-oga-black text-white transition-colors hover:bg-oga-text-primary/90 disabled:opacity-50"
                style={{
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {editing ? 'Save changes' : 'Add shot'}
              </button>
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
      className="tabular bg-oga-bg-input text-oga-text-primary"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 7,
        padding: '7px 10px',
        fontSize: 13,
        width: 120,
      }}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-oga-text-muted uppercase"
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 0.4,
          marginBottom: 6,
        }}
      >
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
    backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
    color: active ? '#0F6E56' : '#111111',
    border: `0.5px solid ${active ? '#1D9E75' : '#E0E0DA'}`,
    borderRadius: 7,
    padding: '7px 10px',
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
type SlopeSelectKey = LieSlope | 'spacer'

const SLOPE_GRID: SlopeSelectKey[] = [
  'uphill',
  'level',
  'downhill',
  'ball_above',
  'spacer',
  'ball_below',
]

const PUTT_GRID: PuttSelectKey[] = [
  'made',
  'short',
  'long',
  'missed_left',
  'missed_right',
  'spacer',
]

function gridButtonStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
    color: active ? '#0F6E56' : '#111111',
    border: `0.5px solid ${active ? '#1D9E75' : '#E0E0DA'}`,
    borderRadius: 7,
    padding: '8px 8px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
  }
}

function LieSlopeGrid({
  value,
  onChange,
}: {
  value: LieSlope | undefined
  onChange: (v: LieSlope) => void
}) {
  return (
    <div
      role="radiogroup"
      className="grid grid-cols-3"
      style={{ gap: 5, maxWidth: 320 }}
    >
      {SLOPE_GRID.map((key, i) =>
        key === 'spacer' ? (
          <div key={`s${i}`} />
        ) : (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(key)}
            style={{
              ...gridButtonStyle(value === key),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <SlopeIcon kind={key} />
            <span>{key.replace('_', ' ')}</span>
          </button>
        ),
      )}
    </div>
  )
}

function SlopeIcon({ kind }: { kind: LieSlope }) {
  const props = {
    width: 32,
    height: 24,
    viewBox: '0 0 32 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
  }
  switch (kind) {
    case 'uphill':
      return (
        <svg {...props}>
          <line x1={4} y1={18} x2={28} y2={8} />
          <circle cx={26} cy={6} r={2} fill="currentColor" stroke="none" />
        </svg>
      )
    case 'level':
      return (
        <svg {...props}>
          <line x1={4} y1={14} x2={28} y2={14} />
          <circle cx={16} cy={11} r={2} fill="currentColor" stroke="none" />
        </svg>
      )
    case 'downhill':
      return (
        <svg {...props}>
          <line x1={4} y1={8} x2={28} y2={18} />
          <circle cx={26} cy={20} r={2} fill="currentColor" stroke="none" />
        </svg>
      )
    case 'ball_above':
      return (
        <svg {...props}>
          <line x1={4} y1={22} x2={28} y2={4} />
          <circle cx={24} cy={4} r={2} fill="currentColor" stroke="none" />
          <line x1={6} y1={22} x2={10} y2={22} />
        </svg>
      )
    case 'ball_below':
      return (
        <svg {...props}>
          <line x1={4} y1={4} x2={28} y2={22} />
          <circle cx={24} cy={22} r={2} fill="currentColor" stroke="none" />
          <line x1={6} y1={4} x2={10} y2={4} />
        </svg>
      )
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
    <div className="grid grid-cols-3" style={{ gap: 5, maxWidth: 320 }}>
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
