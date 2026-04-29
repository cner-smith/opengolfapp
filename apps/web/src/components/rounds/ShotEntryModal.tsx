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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <div className="text-lg font-bold text-fairway-700">
              Shots — Hole {holeNumber}
            </div>
            <div className="text-xs text-gray-500">Par {holePar}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
          <section className="border-r border-gray-100 p-4">
            <div className="mb-2 text-sm font-medium text-gray-700">Shots</div>
            {holeShots.length === 0 && (
              <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-500">
                No shots logged yet.
              </div>
            )}
            <ul className="space-y-1">
              {holeShots.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center justify-between rounded border px-3 py-2 text-xs ${
                    editing === s.id
                      ? 'border-fairway-500 bg-fairway-50'
                      : 'border-gray-100'
                  }`}
                >
                  <div>
                    <div className="font-medium">
                      #{s.shot_number} {s.club ?? '—'} · {s.lie_type ?? 'lie?'}
                    </div>
                    <div className="text-gray-500">
                      {s.shot_result ?? 'no result'}
                      {s.penalty ? ' · penalty' : ''}
                      {s.ob ? ' · OB' : ''}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="rounded px-2 py-1 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      Del
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-700">
                {editing ? `Edit shot #${draft.shotNumber}` : `Add shot #${draft.shotNumber}`}
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-gray-500 hover:underline"
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
                <input
                  type="number"
                  min={0}
                  value={draft.distanceToTarget ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      distanceToTarget: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-32 rounded border border-gray-200 px-2 py-1.5"
                />
              </Field>
            )}

            {isPutt && (
              <>
                <Field label="Putt distance (ft)">
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={draft.puttDistanceFt ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        puttDistanceFt: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-32 rounded border border-gray-200 px-2 py-1.5"
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
                className="w-full rounded border border-gray-200 px-2 py-1.5"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={createShot.isPending || updateShot.isPending}
                className="rounded bg-fairway-500 px-4 py-2 text-white hover:bg-fairway-700 disabled:opacity-50"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-600">{label}</div>
      {children}
    </div>
  )
}

interface ChipGroupProps<T extends string> {
  value: T | undefined
  options: readonly T[]
  onChange: (v: T | undefined) => void
}

function ChipGroup<T extends string>({ value, options, onChange }: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? undefined : opt)}
          className={`rounded-full px-2.5 py-1 text-xs ${
            value === opt
              ? 'bg-fairway-500 text-white'
              : 'border border-gray-200 text-gray-700 hover:bg-fairway-50'
          }`}
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

function gridButtonClass(active: boolean): string {
  return `rounded px-2 py-2 text-xs ${
    active
      ? 'bg-fairway-500 text-white'
      : 'border border-gray-200 text-gray-700 hover:bg-fairway-50'
  }`
}

function LieSlopeGrid({
  value,
  onChange,
}: {
  value: LieSlope | undefined
  onChange: (v: LieSlope | undefined) => void
}) {
  return (
    <div className="grid max-w-xs grid-cols-3 gap-1">
      {SLOPE_GRID.map((key, i) =>
        key === 'spacer' ? (
          <div key={`s${i}`} />
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onChange(value === key ? undefined : key)}
            className={gridButtonClass(value === key)}
          >
            {key.replace('_', ' ')}
          </button>
        ),
      )}
    </div>
  )
}

function PuttResultGrid({
  value,
  onChange,
}: {
  value: PuttResult | undefined
  onChange: (v: PuttResult | undefined) => void
}) {
  return (
    <div className="grid max-w-xs grid-cols-3 gap-1">
      {PUTT_GRID.map((key, i) =>
        key === 'spacer' ? (
          <div key={`s${i}`} />
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onChange(value === key ? undefined : key)}
            className={gridButtonClass(value === key)}
          >
            {key.replace('_', ' ')}
          </button>
        ),
      )}
    </div>
  )
}
