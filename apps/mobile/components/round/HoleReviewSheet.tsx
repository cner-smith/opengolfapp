import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  SHOT_RESULTS,
  SHOT_RESULT_LABELS,
  combinedBreakDirection,
  formatClubLabel,
  horizontalBreakFromAim,
  isPuttEntry,
  isPuttShot,
  obCount,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type Club,
  type GreenSpeed,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ReviewedShotRow,
  type ShotResult,
} from '@oga/core'
import { GreenDiagram } from './GreenDiagram'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface } from '../paper/Paper'
import { Chip, ClubPicker, RockerRows, SlopeGrid, useStackedLabels, type Opt } from '../paper/Pickers'
import { Icon } from '../paper/icons'
import { GAP, P, R } from '../paper/tokens'

export interface HoleReviewSheetProps {
  visible: boolean
  holeNumber: number
  /** Saving the last hole ends the round, so the button says so. */
  isLastHole: boolean
  par: number
  /** Prebuilt by the caller via @oga/core buildInitialRows. The component
   *  owns editing state, hydrating from these once per (hole, visible). */
  initialRows: ReviewedShotRow[]
  saving: boolean
  onSave: (
    rows: ReviewedShotRow[],
    summary: { score: number; putts: number; penalties: number },
  ) => void
  /** Dismiss to let the user drag markers on the map. */
  onEditOnMap: () => void
  /** Shot client-ids aligned 1:1 with initialRows (same order). */
  shotIds: string[]
  /** Delete a shot by id; resolves true on success, false on failure. */
  onDeleteShot: (shotId: string) => Promise<boolean>
}

type EditableRow = ReviewedShotRow & { _shotId: string | undefined }

const PUTT_DISTANCE_OPTIONS: Opt<PuttDistanceResult>[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]
const PUTT_DIRECTION_OPTIONS: Opt<PuttDirectionResult>[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]
// Putt read vocab — mirrors PuttingSheet so the summary and the old sheet
// stay in sync. Break line = the horizontal read, slope = up/down.
const BREAK_LINE_OPTIONS: Opt<BreakDirectionHorizontal>[] = [
  { value: 'left_to_right', label: 'L → R' },
  { value: 'right_to_left', label: 'R → L' },
  { value: 'straight', label: 'Straight' },
]
const BREAK_SLOPE_OPTIONS: Opt<BreakDirectionVertical>[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Level' },
  { value: 'downhill', label: 'Downhill' },
]
const SPEED_OPTIONS: Opt<GreenSpeed>[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

export function HoleReviewSheet({
  visible,
  holeNumber,
  isLastHole,
  par,
  initialRows,
  saving,
  onSave,
  onEditOnMap,
  shotIds,
  onDeleteShot,
}: HoleReviewSheetProps): JSX.Element | null {
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<EditableRow[]>([])
  // Score / putts / penalties are editable tickers. Score and putts pre-fill
  // from the placed shots (shot count, green-lie shots); penalties is the one
  // number no marker implies. All three become the hole_scores values on save.
  const [score, setScore] = useState(0)
  const [putts, setPutts] = useState(0)
  const [penalties, setPenalties] = useState(0)
  // Which putt row (by shotNumber) has the on-demand aimer open, if any. The
  // read tool is a full-screen overlay — never auto-opens.
  const [aimingShot, setAimingShot] = useState<number | null>(null)

  // Read the latest initialRows inside the effect via ref so the effect
  // doesn't re-fire (and clobber user edits) just because the parent returned
  // a new array reference.
  const initialRowsRef = useRef(initialRows)
  initialRowsRef.current = initialRows
  const shotIdsRef = useRef(shotIds)
  shotIdsRef.current = shotIds

  // Hydrate rows once per (hole, visible). After hydration the user's edits
  // are the source of truth — the sheet re-hydrates fresh on next open.
  const hydratedHoleRef = useRef<number | null>(null)
  useEffect(() => {
    if (!visible) {
      hydratedHoleRef.current = null
      return
    }
    if (hydratedHoleRef.current === holeNumber) return
    hydratedHoleRef.current = holeNumber
    const next = initialRowsRef.current
    const ids = shotIdsRef.current
    setRows(next.map((r, i) => ({ ...r, _shotId: ids[i] })))
    // Score seeds from the rows: struck rows + penalty strokes. A
    // stroke-and-distance OB has no row of its own, and the caller marks it on
    // the row it belongs to (shotResult 'ob') — without that term the ticker
    // would re-seed to the struck count and Save would persist it back over
    // the live chip's bump (#839).
    setScore(next.length + obCount(next))
    // Putt TALLY counts any green-lie shot (isPuttShot), matching the SG
    // putting engine + putt-count readers — a bladed wedge on the green still
    // counts as a putt here even though its row shows normal-shot UI (the
    // per-row isPutt gate below stays isPuttEntry). User-overridable ticker.
    setPutts(next.filter((r) => isPuttShot(r.lieType)).length)
    setPenalties(0)
  }, [visible, holeNumber])

  if (!visible) return null

  const setRow = (idx: number, nextRow: ReviewedShotRow) => {
    // Keep the Score ticker in step when the result picker flips a row into
    // or out of 'ob'. An OB row is worth two strokes (the shot plus its
    // rowless stroke-and-distance penalty), and hydration already counted
    // any seeded OB — so without this, clearing OB on a row leaves the
    // score a stroke high and setting it leaves the score a stroke low.
    // Transition-driven, not value-driven: re-selecting the same result is
    // a no-op and cannot double-count. Mirrors web's bump in
    // apps/web/src/components/round/HoleReviewSheet.tsx (#839).
    const prevRow = rows[idx]
    if (prevRow && nextRow.shotResult !== prevRow.shotResult) {
      if (nextRow.shotResult === 'ob') setScore((s) => s + 1)
      else if (prevRow.shotResult === 'ob') setScore((s) => Math.max(0, s - 1))
    }
    setRows((prev) => {
      const copy = prev.slice()
      copy[idx] = { ...nextRow, _shotId: prev[idx]?._shotId }
      return copy
    })
  }

  const confirmDelete = (row: EditableRow) => {
    if (!row._shotId || saving) return
    Alert.alert(
      'Delete this shot?',
      'This removes the shot and renumbers the rest of the hole.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await onDeleteShot(row._shotId!)
            if (!ok) return // handler already showed the connection alert; keep the row
            // Filter + renumber in one atomic update: the server RPC renumbers
            // survivors to stay contiguous (delete #2 of [1,2,3,4] -> [1,2,3]),
            // and this sheet's hydration is gated once per (hole, visible) — a
            // delete changes neither, so without this the sheet would keep
            // stale numbers and saveHoleSummary would re-persist the gap.
            setRows((prev) =>
              prev
                .filter((r) => r._shotId !== row._shotId)
                .map((r) =>
                  r.shotNumber > row.shotNumber
                    ? { ...r, shotNumber: r.shotNumber - 1 }
                    : r,
                ),
            )
            // Keep the tickers honest: one fewer shot, and one fewer putt if it
            // was a green-lie shot (matches the RPC's re-tally). An OB row is
            // worth TWO strokes — the shot plus its stroke-and-distance
            // penalty, which has no row of its own — so deleting it drops 2,
            // matching what delete_shot re-tallies server-side.
            setScore((s) => Math.max(0, s - (row.shotResult === 'ob' ? 2 : 1)))
            if (isPuttShot(row.lieType)) setPutts((p) => Math.max(0, p - 1))
          },
        },
      ],
    )
  }

  return (
    // RN <Modal> is intentionally NOT used — it's an absolute-fill overlay
    // above the map HUD, and the caller mounts this inside the map's gesture
    // root. Our own GestureHandlerRootView lets the aimer overlay's
    // GreenDiagram pan work (mirrors ShotLogger; #496).
    <GestureHandlerRootView
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: P.scrim, zIndex: 40 }}
    >
      {/* Hole review sheet (#611 §11): paper, top ≈ 85 % of the screen. */}
      <PaperSurface
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: insets.top + 123,
          borderTopWidth: 1,
          borderColor: P.ink,
          borderTopLeftRadius: R,
          borderTopRightRadius: R,
          paddingBottom: insets.bottom,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: 16, paddingRight: 8, paddingBottom: 10, paddingLeft: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.serif, { color: P.ink, fontSize: 26, lineHeight: 30 }]}>Nice — how’d it go?</Text>
            <Text style={[TYPE.body, { color: P.ink, fontSize: 13, marginTop: 2 }]}>
              Hole {holeNumber} · par {par}
            </Text>
          </View>
          {/* ✕ = back to the map to fix a marker. Disabled while a save is in
              flight: onEditOnMap drops roundState to PLACE_BALL, but an
              in-flight saveHoleSummary would still advanceAfterHole() out
              from under the player. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close and edit shots on the map"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={onEditOnMap}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.35 : 1 }}
          >
            <Icon.x size={20} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: GAP, paddingTop: 4, paddingHorizontal: 22, paddingBottom: 14 }}>
          <Ticker label="Score" value={score} onChange={setScore} />
          <Ticker label="Putts" value={putts} onChange={setPutts} />
          <Ticker label="Penalties" value={penalties} onChange={setPenalties} warn />
        </View>

        <ScrollView
          style={{ flex: 1, borderTopWidth: 1, borderColor: P.line }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 14 }}
        >
          {rows.length === 0 ? (
            <Text style={[TYPE.body, { color: P.ink, paddingVertical: 22, fontSize: 14 }]}>
              No placed shots. Drop them on the map and try again.
            </Text>
          ) : (
            <>
              <Text style={[TYPE.serif, { color: P.ink, fontSize: 16, paddingTop: 12 }]}>
                Your shots <Text style={[TYPE.body, { fontSize: 13 }]}>· optional</Text>
              </Text>
              {rows.map((row, idx) => (
                <ShotRow
                  // Key on the stable shot id, not shotNumber: confirmDelete
                  // renumbers survivors, so a shotNumber key would shift every
                  // row below a deletion and reattach each ShotRow's local
                  // picker-open state to the wrong shot.
                  key={row._shotId ?? `shot-${row.shotNumber}`}
                  row={row}
                  onOpenAimer={() => setAimingShot(row.shotNumber)}
                  onChange={(nextRow) => setRow(idx, nextRow)}
                  onDelete={() => confirmDelete(row)}
                  deleteDisabled={saving || !row._shotId}
                />
              ))}
            </>
          )}
        </ScrollView>

        <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderColor: P.ink }}>
          <Key
            accessibilityLabel={isLastHole ? 'Save hole and finish round' : 'Save hole and continue to next hole'}
            tone="primary"
            disabled={saving || rows.length === 0}
            onPress={() => onSave(rows, { score, putts, penalties })}
            faceStyle={{ minHeight: 50 }}
          >
            <KeyText tone="primary" bold size={16} disabled={saving || rows.length === 0}>
              {saving ? 'Saving…' : isLastHole ? 'Save & finish round' : 'Save & next hole'}
            </KeyText>
          </Key>
        </View>
      </PaperSurface>

      {aimingShot != null &&
        (() => {
          const idx = rows.findIndex((r) => r.shotNumber === aimingShot)
          if (idx < 0) return null
          return (
            <AimerOverlay
              row={rows[idx]!}
              onChange={(nextRow) => setRow(idx, nextRow)}
              onClose={() => setAimingShot(null)}
            />
          )
        })()}
    </GestureHandlerRootView>
  )
}

// Score / putts / penalties plate (§11): [− value +], 44 dp steppers.
function Ticker({
  label,
  value,
  onChange,
  warn,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  warn?: boolean
}) {
  const Step = ({ delta, disabled }: { delta: number; disabled: boolean }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(Math.max(0, value + delta))}
      style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      <Text style={[TYPE.body, { color: P.ink, fontSize: 22 }]}>{delta < 0 ? '−' : '+'}</Text>
    </Pressable>
  )
  return (
    <PaperSurface
      fill={P.raised}
      style={{ flex: 1, borderWidth: 1, borderColor: P.ink, borderRadius: R, paddingTop: 6, paddingBottom: 4 }}
    >
      <Text style={[TYPE.body, { color: P.ink, fontSize: 12, textAlign: 'center', paddingHorizontal: 8 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Step delta={-1} disabled={value === 0} />
        <Text style={[TYPE.serif, { fontSize: 30, lineHeight: 34, color: warn && value > 0 ? P.warn : P.ink }]}>{value}</Text>
        <Step delta={1} disabled={false} />
      </View>
    </PaperSurface>
  )
}

function ShotRow({
  row,
  onChange,
  onOpenAimer,
  onDelete,
  deleteDisabled,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
  /** Open the full-screen green aimer for this putt row. */
  onOpenAimer: () => void
  /** Delete this shot (confirm dialog owned by the parent). */
  onDelete: () => void
  deleteDisabled: boolean
}) {
  // Putt-ness is the green lie only (set when a putt is placed). Raw distance
  // must NOT classify — a chip/bunker inside 30 yd is not a putt (#660).
  const isPutt = isPuttEntry(row.lieType, row.club)
  const { toDisplay, toDisplayFt } = useUnits()
  const { bag } = useUserBag()
  const stacked = useStackedLabels()
  // The bag (DEFAULT_BAG while empty/loading), plus the row's club when it
  // isn't in the bag, so the picker always shows what the player has.
  const clubOptions = useMemo<Opt<string>[]>(() => {
    const source = bag.length > 0 ? bag : DEFAULT_BAG
    const typeCounts = new Map<string, number>()
    for (const c of source) typeCounts.set(c.club_type, (typeCounts.get(c.club_type) ?? 0) + 1)
    const base = source.map((c) => ({
      value: c.club_type,
      label: formatClubLabel(c, { hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1 }),
    }))
    if (row.club && !base.some((o) => o.value === row.club)) {
      return [{ value: row.club, label: String(row.club) }, ...base]
    }
    return base
  }, [bag, row.club])
  // Which field's options are unfolded inline. One at a time.
  const [open, setOpen] = useState<'club' | 'lie' | 'slope' | 'result' | 'break' | 'speed' | null>(null)
  const toggle = (f: NonNullable<typeof open>) => setOpen((o) => (o === f ? null : f))
  const rawClubLabel = clubOptions.find((c) => c.value === row.club)?.label ?? String(row.club)
  const clubLabel = rawClubLabel.charAt(0).toUpperCase() + rawClubLabel.slice(1)
  const slopeSet = row.lieSlopeForward != null || row.lieSlopeSide != null
  const slopeText = [row.lieSlopeForward && slopeLabel(row.lieSlopeForward), row.lieSlopeSide && slopeLabel(row.lieSlopeSide)]
    .filter(Boolean)
    .join(' · ')
  const breakSet = row.breakDirectionHorizontal != null || row.breakDirectionVertical != null
  const breakText = [
    BREAK_LINE_OPTIONS.find((o) => o.value === row.breakDirectionHorizontal)?.label,
    BREAK_SLOPE_OPTIONS.find((o) => o.value === row.breakDirectionVertical)?.label,
  ]
    .filter(Boolean)
    .join(' · ')
  const speedText = SPEED_OPTIONS.find((o) => o.value === row.greenSpeed)?.label ?? null
  const hasRead = row.aimOffsetInches != null && row.aimOffsetInches !== 0
  const expand = (children: React.ReactNode) => <View style={{ marginTop: 10, gap: 7 }}>{children}</View>

  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: P.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
        <Text style={[TYPE.body, { color: P.ink, fontSize: 13 }]}>Shot {row.shotNumber}</Text>
        <Text style={[TYPE.serif, { color: P.ink, fontSize: 20 }]}>
          {isPutt ? `${toDisplayFt(row.distanceYards * 3)} putt` : toDisplay(row.distanceYards)}
        </Text>
        <Text style={[TYPE.body, { color: P.ink, fontSize: 13, marginLeft: 'auto' }]}>
          {toDisplay(row.distanceToPin)} to pin
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete shot ${row.shotNumber}`}
          disabled={deleteDisabled}
          onPress={onDelete}
          hitSlop={10}
          style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: deleteDisabled ? 0.35 : 1 }}
        >
          <Icon.x size={16} color={P.neg} />
        </Pressable>
      </View>

      {isPutt ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip label={clubLabel} state="set" onPress={() => toggle('club')} />
            <Chip
              label={row.puttMade ? 'Made it ✓' : 'Made it'}
              state={row.puttMade ? 'on' : 'set'}
              accessibilityLabel="Made the putt"
              onPress={() =>
                onChange({
                  ...row,
                  puttMade: !row.puttMade,
                  puttDistanceResult: !row.puttMade ? undefined : row.puttDistanceResult,
                  puttDirectionResult: !row.puttMade ? undefined : row.puttDirectionResult,
                })
              }
            />
            <Chip label={breakSet ? breakText : '+ break'} state={breakSet ? 'set' : 'empty'} onPress={() => toggle('break')} />
            <Chip label={speedText ?? '+ speed'} state={speedText ? 'set' : 'empty'} onPress={() => toggle('speed')} />
            <Chip label="Read ›" state={hasRead ? 'set' : 'empty'} onPress={onOpenAimer} />
          </View>
          {open === 'club' &&
            expand(
              <ClubPicker
                clubs={clubOptions}
                value={row.club ?? null}
                onChange={(v) => {
                  if (v) onChange({ ...row, club: v as Club })
                  setOpen(null)
                }}
              />,
            )}
          {open === 'break' &&
            expand(
              <>
                <RockerRows
                  label="Break"
                  options={BREAK_LINE_OPTIONS}
                  value={row.breakDirectionHorizontal ?? null}
                  onChange={(v) => onChange({ ...row, breakDirectionHorizontal: v ?? undefined })}
                  stacked={stacked}
                />
                <RockerRows
                  label="Slope"
                  options={BREAK_SLOPE_OPTIONS}
                  value={row.breakDirectionVertical ?? null}
                  onChange={(v) => onChange({ ...row, breakDirectionVertical: v ?? undefined })}
                  stacked={stacked}
                />
              </>,
            )}
          {open === 'speed' &&
            expand(
              <RockerRows
                label="Speed"
                options={SPEED_OPTIONS}
                value={row.greenSpeed ?? null}
                onChange={(v) => {
                  onChange({ ...row, greenSpeed: v ?? undefined })
                  setOpen(null)
                }}
                stacked={stacked}
              />,
            )}
          {/* Putt miss = two independent axes (CLAUDE.md) — never one picker. */}
          {!row.puttMade &&
            expand(
              <>
                <RockerRows
                  label="Distance"
                  options={PUTT_DISTANCE_OPTIONS}
                  value={row.puttDistanceResult ?? null}
                  onChange={(v) => onChange({ ...row, puttDistanceResult: v ?? undefined })}
                  stacked={stacked}
                />
                <RockerRows
                  label="Missed"
                  options={PUTT_DIRECTION_OPTIONS}
                  value={row.puttDirectionResult ?? null}
                  onChange={(v) => onChange({ ...row, puttDirectionResult: v ?? undefined })}
                  stacked={stacked}
                />
              </>,
            )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip label={clubLabel} state="set" onPress={() => toggle('club')} />
            <Chip label={LIE_TYPE_LABELS[row.lieType]} state="set" onPress={() => toggle('lie')} />
            <Chip label={slopeSet ? slopeText : '+ slope'} state={slopeSet ? 'set' : 'empty'} onPress={() => toggle('slope')} />
            <Chip
              label={row.shotResult ? SHOT_RESULT_LABELS[row.shotResult] : '+ result'}
              state={row.shotResult ? 'set' : 'empty'}
              onPress={() => toggle('result')}
            />
          </View>
          {open === 'club' &&
            expand(
              <ClubPicker
                clubs={clubOptions}
                value={row.club ?? null}
                onChange={(v) => {
                  if (v) onChange({ ...row, club: v as Club })
                  setOpen(null)
                }}
              />,
            )}
          {open === 'lie' &&
            expand(
              <RockerRows
                label="Lie"
                options={LIE_TYPES.map((l) => ({ value: l, label: LIE_TYPE_LABELS[l] }))}
                value={row.lieType}
                onChange={(v) => {
                  if (v) onChange({ ...row, lieType: v as LieType })
                  setOpen(null)
                }}
                stacked={stacked}
              />,
            )}
          {open === 'slope' &&
            expand(
              <SlopeGrid
                forward={row.lieSlopeForward ?? null}
                side={row.lieSlopeSide ?? null}
                onForward={(v) => onChange({ ...row, lieSlopeForward: v ?? undefined })}
                onSide={(v) => onChange({ ...row, lieSlopeSide: v ?? undefined })}
              />,
            )}
          {open === 'result' &&
            expand(
              <RockerRows
                label="Result"
                options={SHOT_RESULTS.map((r) => ({ value: r, label: SHOT_RESULT_LABELS[r] }))}
                value={row.shotResult ?? null}
                onChange={(v) => {
                  onChange({ ...row, shotResult: (v as ShotResult | null) ?? undefined })
                  setOpen(null)
                }}
                stacked={stacked}
              />,
            )}
        </>
      )}
    </View>
  )
}

// 'ball_above' → 'Ball above', 'uphill' → 'Uphill'.
function slopeLabel(v: string): string {
  const s = v.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// The on-demand read tool: a full-screen overlay hosting the draggable green
// aimer. Setting the aim also derives the horizontal break line (aim off the
// pin = the read), mirroring the putting sheet.
function AimerOverlay({
  row,
  onChange,
  onClose,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const distanceFt = row.distanceYards * 3
  const breakDirection =
    combinedBreakDirection({
      vertical: row.breakDirectionVertical ?? null,
      horizontal: row.breakDirectionHorizontal ?? null,
    }) ?? 'straight'
  return (
    <PaperSurface style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: P.ink }}>
        <Text style={[TYPE.serif, { color: P.ink, fontSize: 26, lineHeight: 30 }]}>Aim & break</Text>
        <Text style={[TYPE.body, { color: P.ink, fontSize: 13, marginTop: 2 }]}>Shot {row.shotNumber} · read the green</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingVertical: 18 }}>
        <GreenDiagram
          distanceFt={distanceFt}
          aimOffsetInches={row.aimOffsetInches ?? 0}
          breakDirection={breakDirection}
          onAimChange={(n) =>
            onChange({
              ...row,
              aimOffsetInches: n,
              breakDirectionHorizontal: horizontalBreakFromAim(n) ?? row.breakDirectionHorizontal,
            })
          }
        />
      </ScrollView>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderColor: P.ink }}>
        <Key accessibilityLabel="Save read" tone="primary" onPress={onClose} faceStyle={{ minHeight: 50 }}>
          <KeyText tone="primary" bold size={16}>
            Save read
          </KeyText>
        </Key>
      </View>
    </PaperSurface>
  )
}
