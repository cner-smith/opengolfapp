import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  PUTT_RESULT_LABELS,
  SHOT_RESULT_LABELS,
  combinedBreakDirection,
  combinedPuttResult,
  formatClubLabel,
  horizontalBreakFromAim,
  formatDistance,
  formatPuttDistance,
  haversineYards,
  isPuttShot,
  type Club,
  type DistanceUnit,
  type LieType,
  type ShotResult,
} from '@oga/core'
import { useUserBag } from '../../hooks/useUserBag'
import type { Database } from '@oga/supabase'
import {
  useCreateShot,
  useDeleteShot,
  useShotsForRound,
  useUpdateShot,
} from '../../hooks/useShots'
import { useAuth } from '../../hooks/useAuth'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useUnits } from '../../hooks/useUnits'
import { toUserMessage } from '../../lib/errors'
import { GreenDiagram } from '../round/GreenDiagram'
import { ChipGroup, Field } from './shots/formInputs'
import {
  emptyDraft,
  shotRowToDraft,
  type DraftShot,
} from './shots/draft'
import { ShotFormFields } from './shots/ShotFormFields'
import { PuttFormFields } from './shots/PuttFormFields'
import { ShotMiniMapPanel } from './shots/ShotMiniMapPanel'

const LIE_TYPE_OPTIONS: { value: LieType; label: string }[] = LIE_TYPES.map(
  (l) => ({ value: l, label: LIE_TYPE_LABELS[l] }),
)

type ShotInsert = Database['public']['Tables']['shots']['Insert']
type ShotRow = Database['public']['Tables']['shots']['Row']

interface ShotEntryModalProps {
  roundId: string
  holeScoreId: string
  holeNumber: number
  holePar: number
  /** Pin coords for this hole (round-pin override → static hole pin →
   *  null). Drives the mini-map's distance_to_target recalc on drag. */
  pinLat: number | null
  pinLng: number | null
  /** True when the modal opens from the live-entry map view. The
   *  per-shot mini-map stays hidden in that case — Mapbox occasionally
   *  errors when a fresh map instance mounts inside an animating sheet
   *  while the parent map view is also visible, and the live-entry
   *  flow already has the round map behind the modal. */
  liveEntry?: boolean
  onClose: () => void
}

export function ShotEntryModal({
  roundId,
  holeScoreId,
  holeNumber,
  holePar,
  pinLat,
  pinLng,
  liveEntry = false,
  onClose,
}: ShotEntryModalProps) {
  const { user } = useAuth()
  const units = useUnits()
  const shotsQuery = useShotsForRound(roundId)
  const createShot = useCreateShot(roundId)
  const updateShot = useUpdateShot(roundId)
  const deleteShot = useDeleteShot(roundId)
  const { bag } = useUserBag()

  // Source club options from the user's bag (in_bag rows, in sort_order).
  // Fall back to DEFAULT_BAG while loading or if the user has trimmed
  // their bag to nothing — never show an empty club picker. Bag custom
  // club_types pass through as plain strings since `shots.club` is a
  // text column. The label routes through `formatClubLabel` so a
  // custom_wedge entry reads as its loft (e.g. "58°"), not the raw
  // "custom_wedge" club_type, and so a bag carrying two clubs of the
  // same `club_type` (e.g. lw 58° + lw 60°) disambiguates by loft.
  const clubOptions = useMemo<{ value: string; label: string }[]>(() => {
    const source = bag.length > 0 ? bag : DEFAULT_BAG
    const typeCounts = new Map<string, number>()
    for (const c of source) {
      typeCounts.set(c.club_type, (typeCounts.get(c.club_type) ?? 0) + 1)
    }
    return source.map((c) => ({
      value: c.club_type,
      label: formatClubLabel(c, {
        hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1,
      }),
    }))
  }, [bag])

  const holeShots = useMemo(() => {
    return (shotsQuery.data ?? [])
      .filter((s) => s.hole_score_id === holeScoreId)
      .sort((a, b) => a.shot_number - b.shot_number)
  }, [shotsQuery.data, holeScoreId])

  const [draft, setDraft] = useState<DraftShot>(() =>
    emptyDraft(holeShots.length + 1, holeShots.length === 0),
  )
  const [editing, setEditing] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Read the latest holeShots count via ref so the reset effect doesn't
  // need it as a dep — a refetch ticking the count up shouldn't wipe the
  // draft the user is filling in. cancelEdit() handles the post-save reset
  // explicitly with the up-to-date length.
  const holeShotsRef = useRef(holeShots)
  holeShotsRef.current = holeShots

  // Highest shot_number this session has issued for the current hole. Guards
  // the refetch race: useCreateShot invalidates without awaiting, so a fast
  // second add can fire before holeShotsRef reflects the first insert — the
  // fresh-max alone would then repeat a number. max(freshMax, lastIssued)+1
  // stays monotonic across consecutive adds regardless of refetch timing.
  // Reset per hole (effect below).
  const lastIssuedNumberRef = useRef(0)

  useEffect(() => {
    if (editing) return
    lastIssuedNumberRef.current = 0
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
    setSaveError(null)
    // Derive the shot_number from the freshest shot list at save time, not
    // from draft.shotNumber. cancelEdit() recomputed the draft number from a
    // stale render closure, so a second consecutive add reused the previous
    // number and hit the unique (hole_score_id, shot_number) constraint —
    // silently, since the old catch only rethrew (#661). holeShots is sorted
    // ascending, so the last element carries the max; lastIssuedNumberRef
    // covers the fast-second-add-before-refetch case (see its declaration).
    const freshMax = holeShotsRef.current.at(-1)?.shot_number ?? 0
    const shotNumber = editing
      ? draft.shotNumber
      : Math.max(freshMax, lastIssuedNumberRef.current) + 1
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
      shot_number: shotNumber,
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
      break_direction: isPuttSave
        ? combinedBreakDirection({
            vertical: draft.breakDirectionVertical,
            horizontal: draft.breakDirectionHorizontal,
          })
        : null,
      break_direction_vertical: isPuttSave
        ? draft.breakDirectionVertical ?? null
        : null,
      break_direction_horizontal: isPuttSave
        ? draft.breakDirectionHorizontal ?? null
        : null,
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
        // Bump the monotonic guard only AFTER a successful insert. Bumping it
        // before would, on a failed save + retry, skip the failed number and
        // leave a permanent gap in shot_number — breaking the editingNext
        // lookup and stats inference (both assume contiguous numbering).
        lastIssuedNumberRef.current = shotNumber
      }
      cancelEdit()
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[ShotEntryModal/save]', err, insert)
      }
      // Surface in the modal instead of rethrowing — the onClick callers never
      // caught, so the failure was an unhandled rejection with no user signal.
      setSaveError(toUserMessage(err))
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function confirmDelete() {
    if (!pendingDeleteId) return
    await deleteShot.mutateAsync(pendingDeleteId)
    if (editing === pendingDeleteId) cancelEdit()
    setPendingDeleteId(null)
  }

  const isPutt = draft.lieType === 'green'

  // Source shot row + its successor for the mini-map. Mini-map shows
  // only when editing a saved shot with start coords; new-shot drafts
  // hide it because there's nothing on the map yet.
  const editingRow = editing ? holeShots.find((s) => s.id === editing) ?? null : null
  const editingNext = editingRow
    ? holeShots.find((s) => s.shot_number === editingRow.shot_number + 1)
    : null
  async function handleMiniMapDrag(point: { lat: number; lng: number }) {
    if (!editingRow) return
    // Mirror RoundMap's drag handler — recalc distance_to_target against
    // the pin so SG for this shot stays accurate. Skipped for putts
    // (distance_to_target stays null; putt_distance_ft tracks that flow
    // and isn't auto-recalculated on drag).
    const editIsPutt = isPuttShot(editingRow.lie_type, editingRow.club)
    const newDistance =
      !editIsPutt && pinLat != null && pinLng != null
        ? Math.round(haversineYards(point.lat, point.lng, pinLat, pinLng))
        : null
    await updateShot.mutateAsync({
      id: editingRow.id,
      updates: {
        start_lat: point.lat,
        start_lng: point.lng,
        ...(editIsPutt ? {} : { distance_to_target: newDistance }),
      },
    })
  }

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
                        {s.club
                          ? formatClubLabel(
                              bag.find((b) => b.club_type === s.club) ?? {
                                club_type: s.club,
                              },
                            )
                          : '—'}
                        {s.lie_type
                          ? ` · ${LIE_TYPE_LABELS[s.lie_type as LieType] ?? s.lie_type}`
                          : ''}
                      </div>
                      <div
                        className="text-caddie-ink-dim"
                        style={{ fontSize: 12, marginTop: 2 }}
                      >
                        {formatShotSummary(s, holeShots[i + 1], units.unit)}
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
                        onClick={() => setPendingDeleteId(s.id)}
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
              {!liveEntry && (
                <ShotMiniMapPanel
                  editingRow={editingRow}
                  editingNext={editingNext}
                  onChangeStart={handleMiniMapDrag}
                />
              )}

              {isPutt && (
                <GreenDiagram
                  distanceFt={draft.puttDistanceFt ?? 0}
                  aimOffsetInches={draft.aimOffsetInches ?? 0}
                  breakDirection={
                    combinedBreakDirection({
                      vertical: draft.breakDirectionVertical,
                      horizontal: draft.breakDirectionHorizontal,
                    }) ?? 'straight'
                  }
                  onAimChange={(n) =>
                    setDraft((d) => ({
                      ...d,
                      aimOffsetInches: n,
                      breakDirectionHorizontal: horizontalBreakFromAim(n),
                    }))
                  }
                />
              )}

              {!isPutt && (
                <Field label="Club">
                  <ChipGroup
                    value={draft.club}
                    options={clubOptions}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, club: v as Club | undefined }))
                    }
                  />
                </Field>
              )}

              <Field label="Lie type">
                <ChipGroup
                  value={draft.lieType}
                  options={LIE_TYPE_OPTIONS}
                  onChange={(v) => setDraft((d) => ({ ...d, lieType: v }))}
                />
              </Field>

              {!isPutt && (
                <ShotFormFields
                  draft={draft}
                  setDraft={setDraft}
                  unit={units.unit}
                />
              )}

              {isPutt && <PuttFormFields draft={draft} setDraft={setDraft} />}

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

            {saveError && (
              <div
                className="text-caddie-neg"
                style={{
                  border: '1px solid #A33A2A',
                  borderRadius: 4,
                  padding: '10px 12px',
                  fontSize: 13,
                  marginTop: 16,
                }}
              >
                {saveError}
              </div>
            )}

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
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this shot?"
        destructive
        confirmLabel="Delete"
        busy={deleteShot.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}

// Build the second line on each shot row in the side panel. Putts get
// putt distance (feet/cm/in/m via formatPuttDistance) plus the
// putt_result label. Other shots get distance_to_target with a
// haversine fallback to the next shot's start coords, plus the
// shot_result label. Only renders '—' when there's truly no signal —
// stored distance, coords, and result columns all null.
function formatShotSummary(
  s: ShotRow,
  next: ShotRow | undefined,
  unit: DistanceUnit,
): string {
  if (isPuttShot(s.lie_type, s.club)) {
    const result =
      (s.putt_result &&
        PUTT_RESULT_LABELS[s.putt_result as keyof typeof PUTT_RESULT_LABELS]) ??
      s.putt_result ??
      null
    const feet = s.putt_distance_ft ?? s.distance_to_target ?? null
    const distance = feet != null ? formatPuttDistance(feet, unit) : null
    const parts = [distance, result].filter(Boolean) as string[]
    return parts.length ? parts.join(' · ') : '—'
  }
  let yards: number | null = s.distance_to_target ?? null
  if (
    yards == null &&
    s.start_lat != null &&
    s.start_lng != null &&
    next?.start_lat != null &&
    next?.start_lng != null
  ) {
    yards = Math.round(
      haversineYards(s.start_lat, s.start_lng, next.start_lat, next.start_lng),
    )
  }
  const distance = yards != null ? formatDistance(yards, unit) : null
  const result = s.shot_result
    ? SHOT_RESULT_LABELS[s.shot_result as ShotResult] ?? s.shot_result
    : null
  const parts = [distance, result].filter(Boolean) as string[]
  return parts.length ? parts.join(' · ') : '—'
}
