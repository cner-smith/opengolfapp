import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  combinedBreakDirection,
  combinedPuttResult,
  formatClubLabel,
  formatDistance,
  formatPuttDistance,
  horizontalBreakFromAim,
  isPuttShot,
  legacyShotResult,
  projectShotMove,
  summarizePuttParts,
  summarizeShotParts,
  type Club,
  type DistanceUnit,
  type LieType,
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
import { ClubPicker, PickerField, RockerRows } from './shots/formInputs'
import { Glyph, chromeSurface } from '../round/map/PaperChrome'
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
  /** Open straight onto this shot (the round map's "Edit shot N", whose
   *  footer has Remove). Without it the editor opens on shot 1 and carries
   *  its own Remove (the scorecard's "4 shots"). */
  editShotId?: string
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
  editShotId,
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

  // The map and the scorecard both open this with the round's shots already
  // cached, so the shot to land on is known on the first render (seeded in
  // the initialisers, not an effect: StrictMode's double-run broke that).
  const opening = editShotId ? holeShots.find((s) => s.id === editShotId) : holeShots[0]
  const [draft, setDraft] = useState<DraftShot>(() =>
    opening ? shotRowToDraft(opening) : emptyDraft(holeShots.length + 1, holeShots.length === 0),
  )
  const [editing, setEditing] = useState<string | null>(() => opening?.id ?? null)
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

  // The number a new shot gets (see lastIssuedNumberRef).
  const nextNumber = () =>
    Math.max(holeShotsRef.current.at(-1)?.shot_number ?? 0, lastIssuedNumberRef.current) + 1

  function startEdit(s: ShotRow) {
    setEditing(s.id)
    setDraft(shotRowToDraft(s))
  }

  function startAdd() {
    setEditing(null)
    const n = nextNumber()
    setDraft(emptyDraft(n, n === 1))
  }

  // Resolves true once the shot is stored.
  async function save(): Promise<boolean> {
    if (!user) return false
    setSaveError(null)
    // Derive the shot_number from the freshest shot list at save time, not
    // from draft.shotNumber. cancelEdit() recomputed the draft number from a
    // stale render closure, so a second consecutive add reused the previous
    // number and hit the unique (hole_score_id, shot_number) constraint —
    // silently, since the old catch only rethrew (#661). holeShots is sorted
    // ascending, so the last element carries the max; lastIssuedNumberRef
    // covers the fast-second-add-before-refetch case (see its declaration).
    // An edit keeps the row's current number: deleting an earlier shot
    // renumbers it (delete_shot) after the draft was taken.
    const shotNumber = editing
      ? holeShots.find((s) => s.id === editing)?.shot_number ?? draft.shotNumber
      : nextNumber()
    const isPuttSave = isPuttShot(draft.lieType)
    const made = draft.puttMade
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
      shot_result: isPuttSave ? null : legacyShotResult(draft),
      contact: isPuttSave ? null : draft.contact ?? null,
      shape: isPuttSave ? null : draft.shape ?? null,
      start_line: isPuttSave ? null : draft.startLine ?? null,
      distance_to_target: isPuttSave ? null : draft.distanceToTarget ?? null,
      putt_distance_ft: isPuttSave ? draft.puttDistanceFt ?? null : null,
      putt_result: legacyPuttResult,
      putt_distance_result: isPuttSave ? distanceResult : null,
      putt_direction_result: isPuttSave ? directionResult : null,
      putt_slope_pct: isPuttSave ? draft.puttSlopePct ?? null : null,
      green_speed: isPuttSave ? draft.greenSpeed ?? null : null,
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
      penalty: !isPuttSave && !!draft.penalty,
      ob: !isPuttSave && !!draft.ob,
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
      return true
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[ShotEntryModal/save]', err, insert)
      }
      // Surface in the modal instead of rethrowing — the onClick callers never
      // caught, so the failure was an unhandled rejection with no user signal.
      setSaveError(toUserMessage(err))
      return false
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function confirmDelete() {
    if (!pendingDeleteId) return
    await deleteShot.mutateAsync(pendingDeleteId)
    setPendingDeleteId(null)
    onClose()
  }

  const isPutt = isPuttShot(draft.lieType)

  // Source shot row + its successor for the mini-map. Mini-map shows
  // only when editing a saved shot with start coords; new-shot drafts
  // hide it because there's nothing on the map yet.
  const editingRow = editing ? holeShots.find((s) => s.id === editing) ?? null : null
  const editingNext = editingRow
    ? holeShots.find((s) => s.shot_number === editingRow.shot_number + 1)
    : null
  async function handleMiniMapDrag(point: { lat: number; lng: number }) {
    if (!editingRow) return
    // Same rule as RoundMap's drag: a full shot gets a new distance_to_target,
    // a putt a new length (#1096); undefined leaves the column alone (no pin,
    // #662). The draft follows, or Save would write the old value back.
    const pin = pinLat != null && pinLng != null ? { lat: pinLat, lng: pinLng } : null
    const proj = projectShotMove({ newStart: point, pin, isPutt: isPuttShot(editingRow.lie_type) })
    const newDistance = isPuttShot(editingRow.lie_type) ? undefined : proj.distanceToTarget
    await updateShot.mutateAsync({
      id: editingRow.id,
      updates: {
        start_lat: point.lat,
        start_lng: point.lng,
        ...(newDistance !== undefined ? { distance_to_target: newDistance } : {}),
        ...(proj.puttDistanceFt !== undefined ? { putt_distance_ft: proj.puttDistanceFt } : {}),
      },
    })
    setDraft((d) => ({
      ...d,
      ...(newDistance !== undefined ? { distanceToTarget: newDistance ?? undefined } : {}),
      ...(proj.puttDistanceFt !== undefined
        ? { puttDistanceFt: proj.puttDistanceFt ?? undefined }
        : {}),
    }))
  }

  const busy = createShot.isPending || updateShot.isPending
  const idx = editingRow ? holeShots.indexOf(editingRow) : holeShots.length
  const prevShot = idx > 0 ? holeShots[idx - 1]! : null
  // Past the last shot, › opens a new one.
  const nextShot: ShotRow | 'new' | null = !editingRow ? null : holeShots[idx + 1] ?? 'new'
  const mapped =
    editingRow?.start_lat != null && editingRow.start_lng != null && pinLat != null && pinLng != null
  const toPin = !editingRow
    ? `par ${holePar}`
    : isPuttShot(editingRow.lie_type)
      ? editingRow.putt_distance_ft != null
        ? `${formatPuttDistance(editingRow.putt_distance_ft, units.unit)} to the pin`
        : null
      : editingRow.distance_to_target != null
        ? `${formatDistance(editingRow.distance_to_target, units.unit)} to the pin`
        : null

  // ‹ › keep an edit (as mobile's sheet does) and move on; an untouched
  // shot isn't rewritten. Leaving a new shot drops it, like Cancel.
  async function step(target: ShotRow | 'new') {
    if (editingRow && JSON.stringify(draft) !== JSON.stringify(shotRowToDraft(editingRow))) {
      if (!(await save())) return
    }
    setSaveError(null)
    if (target === 'new') startAdd()
    else startEdit(target)
  }

  async function onSave() {
    if (!(await save())) return
    if (editing) onClose()
    else startAdd()
  }

  const stepKey = (dir: 'prev' | 'next', target: ShotRow | 'new' | null) => (
    <button
      type="button"
      aria-label={
        target === 'new' ? 'Add a shot' : dir === 'prev' ? 'Previous shot' : 'Next shot'
      }
      disabled={!target || busy}
      onClick={() => target && void step(target)}
      className="key"
      style={{ width: 44, padding: 0, flexShrink: 0 }}
    >
      {target === 'new' ? Glyph.plus() : dir === 'prev' ? Glyph.prev() : Glyph.next()}
    </button>
  )

  return (
    <div className="shot-sheet-scrim fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shot-editor-title"
        className="shot-sheet flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
        style={chromeSurface}
      >
        <header className="flex items-center" style={{ minHeight: 72, padding: '6px 8px 6px 22px', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, padding: '4px 0' }}>
            <h2
              id="shot-editor-title"
              className="font-serif text-caddie-ink"
              style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.15 }}
            >
              Shot {editingRow ? editingRow.shot_number : nextNumber()}
              <span className="serif-italic" style={{ fontSize: 18 }}>
                {editingRow ? (holeShots.length > 1 ? ` of ${holeShots.length}` : '') : ' new'}
              </span>
            </h2>
            <div className="text-caddie-ink" style={{ fontSize: 13 }}>
              Hole {holeNumber}
              {toPin ? ` · ${toPin}` : ''}
            </div>
          </div>
          {stepKey('prev', editingRow ? prevShot : holeShots.at(-1) ?? null)}
          {stepKey('next', nextShot)}
          <button
            type="button"
            aria-label="Close shot editor"
            onClick={onClose}
            className="flex items-center justify-center text-caddie-ink"
            style={{ width: 44, height: 44, flexShrink: 0, background: 'none', border: 'none' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[240px_1fr]">
          {/* The hole's shots, a jump list beside the editor on wide screens;
              a phone steps with ‹ › instead. */}
          <nav aria-label={`Hole ${holeNumber} shots`} className="hidden md:block" style={{ borderTop: '1px solid #D9D2BF', borderRight: '1px solid #D9D2BF' }}>
            <ul>
              {holeShots.map((s, i) => (
                <li key={s.id} style={{ borderBottom: '1px solid #D9D2BF' }}>
                  <button
                    type="button"
                    aria-current={editing === s.id ? 'true' : undefined}
                    onClick={() => editing !== s.id && void step(s)}
                    disabled={busy}
                    className="flex w-full items-center text-left text-caddie-ink"
                    style={{
                      minHeight: 56,
                      gap: 10,
                      padding: '8px 12px 8px 14px',
                      background: editing === s.id ? '#E4DCCA' : 'transparent',
                    }}
                  >
                    <span
                      className="serif-italic tabular"
                      style={{
                        minWidth: 26,
                        height: 26,
                        padding: '0 5px',
                        flexShrink: 0,
                        border: '1px solid #1C211C',
                        borderRadius: 3,
                        background: s.ob ? '#A33A2A' : '#FBF8F1',
                        color: s.ob ? '#FBF8F1' : '#1C211C',
                        fontSize: 17,
                        lineHeight: '24px',
                        textAlign: 'center',
                      }}
                    >
                      {s.shot_number}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="block" style={{ fontSize: 15 }}>
                        {s.lie_type ? LIE_TYPE_LABELS[s.lie_type as LieType] ?? s.lie_type : 'No lie'}
                        {' · '}
                        {s.club ? (
                          formatClubLabel(bag.find((b) => b.club_type === s.club) ?? { club_type: s.club })
                        ) : (
                          <span className="text-caddie-ink-dim">no club</span>
                        )}
                      </span>
                      <span className="block text-caddie-ink-dim" style={{ fontSize: 13 }}>
                        {formatShotSummary(s, holeShots[i + 1], units.unit)}
                      </span>
                    </span>
                    <span aria-hidden>{Glyph.next()}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  aria-current={!editing ? 'true' : undefined}
                  onClick={() => editing && void step('new')}
                  disabled={busy}
                  className="flex w-full items-center text-left text-caddie-ink"
                  style={{
                    minHeight: 48,
                    gap: 10,
                    padding: '8px 12px 8px 14px',
                    fontSize: 15,
                    background: !editing ? '#E4DCCA' : 'transparent',
                  }}
                >
                  <span className="flex items-center justify-center" style={{ width: 26 }}>{Glyph.plus()}</span>
                  Add a shot
                </button>
              </li>
            </ul>
          </nav>

          <section key={editing ?? 'new'} className="flex flex-col" style={{ padding: '0 22px 8px' }}>
            {!liveEntry && editingRow?.start_lat != null && (
              <div style={{ paddingBottom: 12 }}>
                <ShotMiniMapPanel
                  editingRow={editingRow}
                  editingNext={editingNext}
                  onChangeStart={handleMiniMapDrag}
                />
              </div>
            )}

            {isPutt && (
              <div style={{ paddingBottom: 12 }}>
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
              </div>
            )}

            {!isPutt && (
              <PickerField title="Club">
                <ClubPicker
                  clubs={clubOptions}
                  value={draft.club}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, club: (v ?? undefined) as Club | undefined }))
                  }
                />
              </PickerField>
            )}

            <PickerField title="Lie">
              <RockerRows
                name="Lie"
                options={LIE_TYPE_OPTIONS}
                value={draft.lieType}
                onChange={(v) => setDraft((d) => ({ ...d, lieType: v ?? undefined }))}
              />
            </PickerField>

            {!isPutt && (
              <ShotFormFields
                draft={draft}
                setDraft={setDraft}
                unit={units.unit}
                mapped={mapped}
              />
            )}

            {isPutt && <PuttFormFields draft={draft} setDraft={setDraft} />}

            <PickerField title="Notes">
              <input
                type="text"
                aria-label="Notes"
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                className="w-full text-caddie-ink"
                style={{
                  background: '#FBF8F1',
                  border: '1px solid #1C211C',
                  borderRadius: 3,
                  minHeight: 44,
                  padding: '0 12px',
                  fontSize: 15,
                }}
              />
            </PickerField>
          </section>
        </div>

        {saveError && (
          <div
            role="alert"
            className="text-caddie-neg"
            style={{ borderTop: '1px solid #A33A2A', padding: '10px 22px', fontSize: 13 }}
          >
            {saveError}
          </div>
        )}

        <footer
          className="flex"
          style={{ gap: 8, padding: '10px 12px 13px', borderTop: '1px solid #1C211C', flexShrink: 0 }}
        >
          {!editShotId && editingRow && (
            <button
              type="button"
              onClick={() => setPendingDeleteId(editingRow.id)}
              disabled={busy}
              className="key"
              style={{ color: '#A33A2A' }}
            >
              Remove
            </button>
          )}
          <div className="hidden flex-1 sm:block" />
          <button type="button" onClick={onClose} className="key flex-1 sm:flex-none">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={busy}
            className="key key-primary flex-1 sm:flex-none"
            style={{ fontSize: 16, fontWeight: 700, minWidth: 120 }}
          >
            {busy ? 'Saving…' : editing ? 'Save' : 'Add shot'}
          </button>
        </footer>
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this shot?"
        message="This removes the shot and renumbers the rest of the hole."
        destructive
        confirmLabel="Delete"
        busy={deleteShot.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}

// Build the second line on each shot row in the side panel. Formatting
// lives in @oga/core (summarizePuttParts / summarizeShotParts, shared with
// mobile's review stepper); this wrapper only picks the branch and the
// '—' empty state.
function formatShotSummary(
  s: ShotRow,
  next: ShotRow | undefined,
  unit: DistanceUnit,
): string {
  const parts = isPuttShot(s.lie_type)
    ? summarizePuttParts(s, unit)
    : summarizeShotParts(s, next, unit)
  return parts.length ? parts.join(' · ') : '—'
}
