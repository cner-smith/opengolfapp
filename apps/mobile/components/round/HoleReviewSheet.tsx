import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Alert, ScrollView, Text, View, type TextStyle } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  DEFAULT_BAG,
  LIE_TYPES,
  LIE_TYPE_LABELS,
  LIE_SLOPES_FORWARD,
  LIE_SLOPES_SIDE,
  SHOT_RESULTS,
  SHOT_RESULT_LABELS,
  combinedBreakDirection,
  formatClubLabel,
  horizontalBreakFromAim,
  isPuttEntry,
  isPuttShot,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type Club,
  type GreenSpeed,
  type LieType,
  type LieSlopeForward,
  type LieSlopeSide,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ReviewedShotRow,
  type ShotResult,
} from '@oga/core'
import { GreenDiagram } from './GreenDiagram'
import { PressableTouch } from '../ui/PressableTouch'
import { useUnits } from '../../hooks/useUnits'
import { useUserBag } from '../../hooks/useUserBag'
import { TYPE } from '../../lib/typography'

export interface HoleReviewSheetProps {
  visible: boolean
  holeNumber: number
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

// Palette — mirrors the web review sheet hexes exactly. Static objects only;
// NativeWind css-interop drops function styles on iOS (#303).
const C = {
  bg: '#FBF8F1',
  surface: '#F2EEE5',
  expand: '#EBE5D6',
  line: '#D9D2BF',
  border: '#9F9580',
  mute: '#8A8B7E',
  accent: '#1F3D2C',
  accentInk: '#F2EEE5',
  ink: '#1C211C',
  amber: '#A66A1F',
  brick: '#A33A2A',
} as const

const KICKER: TextStyle = {
  color: C.mute,
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const PUTT_DISTANCE_OPTIONS: { value: PuttDistanceResult; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]
const PUTT_DIRECTION_OPTIONS: { value: PuttDirectionResult; label: string }[] = [
  { value: 'left', label: 'Missed left' },
  { value: 'right', label: 'Missed right' },
]
// Putt read vocab — mirrors PuttingSheet so the summary and the old sheet
// stay in sync. Break line = the horizontal read, slope = up/down.
const BREAK_LINE_OPTIONS: { value: BreakDirectionHorizontal; label: string }[] = [
  { value: 'left_to_right', label: 'L → R' },
  { value: 'right_to_left', label: 'R → L' },
  { value: 'straight', label: 'Straight' },
]
const BREAK_SLOPE_OPTIONS: { value: BreakDirectionVertical; label: string }[] = [
  { value: 'uphill', label: 'Uphill' },
  { value: 'flat', label: 'Level' },
  { value: 'downhill', label: 'Downhill' },
]
const SPEED_OPTIONS: { value: GreenSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

export function HoleReviewSheet({
  visible,
  holeNumber,
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
    setScore(next.length)
    // Putt TALLY counts any green-lie shot (isPuttShot), matching the SG
    // putting engine + putt-count readers — a bladed wedge on the green still
    // counts as a putt here even though its row shows normal-shot UI (the
    // per-row isPutt gate below stays isPuttEntry). User-overridable ticker.
    setPutts(next.filter((r) => isPuttShot(r.lieType)).length)
    setPenalties(0)
  }, [visible, holeNumber])

  if (!visible) return null

  const vsPar = score > 0 ? score - par : null

  const setRow = (idx: number, nextRow: ReviewedShotRow) =>
    setRows((prev) => {
      const copy = prev.slice()
      copy[idx] = { ...nextRow, _shotId: prev[idx]?._shotId }
      return copy
    })

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
            setRows((prev) => prev.filter((r) => r._shotId !== row._shotId))
            // Keep the tickers honest: one fewer shot, and one fewer putt if it
            // was a green-lie shot (matches the RPC's re-tally).
            setScore((s) => Math.max(0, s - 1))
            if (isPuttShot(row.lieType)) setPutts((p) => Math.max(0, p - 1))
          },
        },
      ],
    )
  }

  return (
    // RN <Modal> is intentionally NOT used — the web sheet is an absolute-fill
    // overlay above the map HUD, and the caller mounts this inside the map's
    // gesture root. Wrap in our own GestureHandlerRootView so the aimer
    // overlay's GreenDiagram pan works (mirrors ShotLogger; #496).
    <GestureHandlerRootView
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: C.bg,
        borderTopWidth: 1,
        borderColor: C.border,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        zIndex: 40,
      }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={{ alignItems: 'center', paddingTop: 8, marginBottom: 12 }}>
          <View
            style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: C.line }}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 22,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderColor: C.line,
          }}
        >
          <Text style={[TYPE.kicker, KICKER, { marginBottom: 4 }]}>
            Hole {holeNumber} · Par {par}
          </Text>
          <Text
            style={[
              TYPE.serif,
              { color: C.ink, fontSize: 24, marginBottom: 14 },
            ]}
          >
            Nice — how'd it go?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Ticker label="Score" value={score} onChange={setScore} vsPar={vsPar} />
            <Ticker label="Putts" value={putts} onChange={setPutts} />
            <Ticker label="Penalties" value={penalties} onChange={setPenalties} amber />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 14 }}
        >
          {rows.length === 0 ? (
            <Text style={[TYPE.body, { color: C.mute, padding: 22, fontSize: 13 }]}>
              No placed shots. Drop pins on the map and try again.
            </Text>
          ) : (
            <>
              <Text
                style={[
                  TYPE.kicker,
                  KICKER,
                  { color: C.mute, paddingTop: 10, paddingBottom: 2 },
                ]}
              >
                Your shots · optional
              </Text>
              {rows.map((row, idx) => (
                <ShotRow
                  key={row.shotNumber}
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

        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'flex-end',
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: insets.bottom + 18,
            borderTopWidth: 1,
            borderColor: C.line,
            backgroundColor: C.bg,
          }}
        >
          <PressableTouch
            accessibilityRole="button"
            accessibilityLabel="Edit shots on the map"
            // Disabled while a save is in flight: onEditOnMap drops roundState
            // to PLACE_BALL and closes the sheet, but an in-flight saveHoleSummary
            // (async) still finishes and would then advanceAfterHole() out from
            // under the player — mirror the Save button's guard so the two can't
            // race.
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={onEditOnMap}
            style={{
              borderWidth: 1,
              borderColor: C.accent,
              borderRadius: 2,
              paddingVertical: 12,
              paddingHorizontal: 16,
              opacity: saving ? 0.4 : 1,
            }}
          >
            <Text
              style={[
                TYPE.bodyBold,
                { color: C.accent, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
              ]}
            >
              Edit on map
            </Text>
          </PressableTouch>
          <PressableTouch
            accessibilityRole="button"
            accessibilityLabel="Save hole and continue to next hole"
            accessibilityState={{ disabled: saving || rows.length === 0 }}
            disabled={saving || rows.length === 0}
            onPress={() => onSave(rows, { score, putts, penalties })}
            style={{
              borderRadius: 2,
              paddingVertical: 12,
              paddingHorizontal: 18,
              backgroundColor: C.accent,
              opacity: saving || rows.length === 0 ? 0.4 : 1,
            }}
          >
            <Text
              style={[
                TYPE.bodyBold,
                { color: C.accentInk, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
              ]}
            >
              {saving ? 'Saving…' : 'Save & next hole →'}
            </Text>
          </PressableTouch>
        </View>
      </View>

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

function Ticker({
  label,
  value,
  onChange,
  vsPar,
  amber,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  vsPar?: number | null
  amber?: boolean
}) {
  const vsParText =
    vsPar == null ? null : vsPar === 0 ? 'E' : vsPar > 0 ? `+${vsPar}` : `${vsPar}`
  // Muted brick over par, forest under, mute at even — never a bright red.
  const vsParColor =
    vsPar == null || vsPar === 0 ? C.mute : vsPar > 0 ? C.brick : C.accent
  const Step = ({ delta, disabled }: { delta: number; disabled: boolean }) => (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={`${delta < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(Math.max(0, value + delta))}
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.25 : 1,
      }}
    >
      <Text style={{ color: C.mute, fontSize: 15, lineHeight: 17 }}>
        {delta < 0 ? '−' : '+'}
      </Text>
    </PressableTouch>
  )
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingTop: 9,
        paddingBottom: 8,
        alignItems: 'center',
        gap: 5,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Step delta={-1} disabled={value === 0} />
        <Text
          style={[
            TYPE.serifUpright,
            {
              fontSize: 26,
              lineHeight: 28,
              minWidth: 20,
              textAlign: 'center',
              color: amber && value > 0 ? C.amber : C.ink,
            },
          ]}
        >
          {value}
        </Text>
        <Step delta={1} disabled={false} />
      </View>
      <Text style={[TYPE.kicker, KICKER, { color: C.mute }]}>
        {label}
        {vsParText != null && (
          <Text style={{ color: vsParColor }}> · {vsParText}</Text>
        )}
      </Text>
    </View>
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
  // Source the club options from the user's bag, falling back to DEFAULT_BAG
  // when empty/loading. Splice in the row's current club when it isn't in the
  // bag so the picker always shows what the player has. Labels route through
  // formatClubLabel so a custom_wedge reads as its loft.
  const clubOptions = useMemo<{ value: string; label: string }[]>(() => {
    const source = bag.length > 0 ? bag : DEFAULT_BAG
    const typeCounts = new Map<string, number>()
    for (const c of source) {
      typeCounts.set(c.club_type, (typeCounts.get(c.club_type) ?? 0) + 1)
    }
    const base = source.map((c) => ({
      value: c.club_type,
      label: formatClubLabel(c, {
        hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1,
      }),
    }))
    if (row.club && !base.some((o) => o.value === row.club)) {
      return [{ value: row.club, label: String(row.club) }, ...base]
    }
    return base
  }, [bag, row.club])
  // Which field's options are unfolded inline (Version A). One at a time.
  const [open, setOpen] = useState<
    'club' | 'lie' | 'slope' | 'result' | 'break' | 'speed' | null
  >(null)
  const toggle = (f: NonNullable<typeof open>) =>
    setOpen((o) => (o === f ? null : f))
  // Chip labels are Sentence case across lie/slope/result; formatClubLabel
  // returns lowercase shorthand ("driver", "8i", "pw"), so capitalize the club
  // chip to match. Digit-led codes ("8i", "3w") are unchanged.
  const rawClubLabel =
    clubOptions.find((c) => c.value === row.club)?.label ?? String(row.club)
  const clubLabel = rawClubLabel.charAt(0).toUpperCase() + rawClubLabel.slice(1)
  const slopeSet = row.lieSlopeForward != null || row.lieSlopeSide != null
  const slopeText = [
    row.lieSlopeForward && slopeLabel(row.lieSlopeForward),
    row.lieSlopeSide && slopeLabel(row.lieSlopeSide),
  ]
    .filter(Boolean)
    .join(' · ')
  const breakSet =
    row.breakDirectionHorizontal != null || row.breakDirectionVertical != null
  const breakText = [
    BREAK_LINE_OPTIONS.find((o) => o.value === row.breakDirectionHorizontal)?.label,
    BREAK_SLOPE_OPTIONS.find((o) => o.value === row.breakDirectionVertical)?.label,
  ]
    .filter(Boolean)
    .join(' · ')
  const speedText =
    SPEED_OPTIONS.find((o) => o.value === row.greenSpeed)?.label ?? null
  const hasRead = row.aimOffsetInches != null && row.aimOffsetInches !== 0

  return (
    <View style={{ paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 9,
        }}
      >
        <Text style={[TYPE.kicker, KICKER, { color: C.mute }]}>
          Shot {row.shotNumber}
        </Text>
        <Text style={[TYPE.serif, { color: C.ink, fontSize: 20 }]}>
          {isPutt
            ? `${toDisplayFt(row.distanceYards * 3)} putt`
            : toDisplay(row.distanceYards)}
        </Text>
        <Text style={[TYPE.body, { color: C.mute, fontSize: 12, marginLeft: 'auto' }]}>
          {toDisplay(row.distanceToPin)} to pin
        </Text>
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel={`Delete shot ${row.shotNumber}`}
          disabled={deleteDisabled}
          onPress={onDelete}
          hitSlop={8}
          style={{ padding: 6, alignSelf: 'center', opacity: deleteDisabled ? 0.4 : 1 }}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.brick} />
        </PressableTouch>
      </View>

      {isPutt ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <FieldChip
              label={clubLabel}
              filled
              active={open === 'club'}
              onPress={() => toggle('club')}
            />
            <PressableTouch
              accessibilityRole="button"
              accessibilityLabel="Made the putt"
              accessibilityState={{ selected: !!row.puttMade }}
              onPress={() =>
                onChange({
                  ...row,
                  puttMade: !row.puttMade,
                  puttDistanceResult: !row.puttMade ? undefined : row.puttDistanceResult,
                  puttDirectionResult: !row.puttMade ? undefined : row.puttDirectionResult,
                })
              }
              style={{
                backgroundColor: row.puttMade ? C.accent : C.bg,
                borderWidth: 1,
                borderColor: C.accent,
                borderRadius: 16,
                paddingVertical: 5,
                paddingHorizontal: 14,
              }}
            >
              <Text
                style={[
                  TYPE.bodyBold,
                  {
                    color: row.puttMade ? C.surface : C.accent,
                    fontSize: 12,
                    fontWeight: '600',
                  },
                ]}
              >
                {row.puttMade ? 'Made it ✓' : 'Made it'}
              </Text>
            </PressableTouch>
            <FieldChip
              label={breakSet ? breakText : '+ break'}
              filled={breakSet}
              active={open === 'break'}
              onPress={() => toggle('break')}
            />
            <FieldChip
              label={speedText ?? '+ speed'}
              filled={!!speedText}
              active={open === 'speed'}
              onPress={() => toggle('speed')}
            />
            <FieldChip label="Read ▸" filled={hasRead} onPress={onOpenAimer} />
          </View>
          {open === 'club' && (
            <ChipExpand
              label="Club"
              options={clubOptions}
              value={row.club}
              onSelect={(v) => {
                onChange({ ...row, club: v as Club })
                setOpen(null)
              }}
            />
          )}
          {open === 'break' && <BreakExpand row={row} onChange={onChange} />}
          {open === 'speed' && (
            <ChipExpand
              label="Speed"
              options={SPEED_OPTIONS}
              value={row.greenSpeed}
              onSelect={(v) => {
                onChange({ ...row, greenSpeed: row.greenSpeed === v ? undefined : v })
                setOpen(null)
              }}
            />
          )}
          {!row.puttMade && (
            <View style={{ marginTop: 10 }}>
              <PuttMissAxes row={row} onChange={onChange} />
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <FieldChip
              label={clubLabel}
              filled
              active={open === 'club'}
              onPress={() => toggle('club')}
            />
            <FieldChip
              label={LIE_TYPE_LABELS[row.lieType]}
              filled
              active={open === 'lie'}
              onPress={() => toggle('lie')}
            />
            <FieldChip
              label={slopeSet ? slopeText : '+ slope'}
              filled={slopeSet}
              active={open === 'slope'}
              onPress={() => toggle('slope')}
            />
            <FieldChip
              label={row.shotResult ? SHOT_RESULT_LABELS[row.shotResult] : '+ result'}
              filled={!!row.shotResult}
              active={open === 'result'}
              onPress={() => toggle('result')}
            />
          </View>
          {open === 'club' && (
            <ChipExpand
              label="Club"
              options={clubOptions}
              value={row.club}
              onSelect={(v) => {
                onChange({ ...row, club: v as Club })
                setOpen(null)
              }}
            />
          )}
          {open === 'lie' && (
            <ChipExpand
              label="Lie"
              options={LIE_TYPES.map((l) => ({ value: l, label: LIE_TYPE_LABELS[l] }))}
              value={row.lieType}
              onSelect={(v) => {
                onChange({ ...row, lieType: v as LieType })
                setOpen(null)
              }}
            />
          )}
          {open === 'slope' && <SlopeExpand row={row} onChange={onChange} />}
          {open === 'result' && (
            <ChipExpand
              label="Result"
              options={SHOT_RESULTS.map((r) => ({ value: r, label: SHOT_RESULT_LABELS[r] }))}
              value={row.shotResult}
              onSelect={(v) => {
                onChange({
                  ...row,
                  shotResult: row.shotResult === v ? undefined : (v as ShotResult),
                })
                setOpen(null)
              }}
            />
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

// A field entry on a shot row: filled (forest), blank ("+ field", dashed), or
// active (unfolded — light forest). Tapping unfolds/collapses its options.
function FieldChip({
  label,
  filled,
  active,
  onPress,
}: {
  label: string
  filled?: boolean
  active?: boolean
  onPress: () => void
}) {
  const bg = active ? '#E6EDE6' : filled ? C.accent : 'transparent'
  const color = active ? C.accent : filled ? C.surface : C.mute
  const border = active || filled ? C.accent : C.border
  return (
    <PressableTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: active }}
      onPress={onPress}
      style={{
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: filled || active ? 'solid' : 'dashed',
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Text style={[TYPE.body, { color, fontSize: 12 }]}>
        {label}
        {active ? ' ▾' : ''}
      </Text>
    </PressableTouch>
  )
}

function OptChip({
  label,
  on,
  onPress,
}: {
  label: string
  on: boolean
  onPress: () => void
}) {
  return (
    <PressableTouch
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: on ? C.accent : C.line,
        backgroundColor: on ? C.accent : C.surface,
      }}
    >
      <Text style={[TYPE.body, { color: on ? C.surface : C.ink, fontSize: 11 }]}>
        {label}
      </Text>
    </PressableTouch>
  )
}

// Inline unfolded options for a single-select field (club / lie / result).
function ChipExpand<V extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: readonly { value: V; label: string }[]
  value: V | undefined
  onSelect: (v: V) => void
}) {
  return (
    <View
      style={{
        marginTop: 9,
        backgroundColor: C.expand,
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 10,
      }}
    >
      <Text style={[TYPE.kicker, KICKER, { color: C.mute, marginBottom: 7 }]}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => (
          <OptChip
            key={o.value}
            label={o.label}
            on={o.value === value}
            onPress={() => onSelect(o.value)}
          />
        ))}
      </View>
    </View>
  )
}

// The two-axis slope grid (uphill/level/downhill × ball above/below), unfolded
// inline. Each axis toggles independently; either can stay unset.
function SlopeExpand({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  return (
    <View
      style={{
        marginTop: 9,
        backgroundColor: C.expand,
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 10,
        gap: 9,
      }}
    >
      <View>
        <Text style={[TYPE.kicker, KICKER, { color: C.mute, marginBottom: 6 }]}>
          Uphill / downhill
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {LIE_SLOPES_FORWARD.map((f) => (
            <OptChip
              key={f}
              label={slopeLabel(f)}
              on={row.lieSlopeForward === f}
              onPress={() =>
                onChange({
                  ...row,
                  lieSlopeForward:
                    row.lieSlopeForward === f ? undefined : (f as LieSlopeForward),
                })
              }
            />
          ))}
        </View>
      </View>
      <View>
        <Text style={[TYPE.kicker, KICKER, { color: C.mute, marginBottom: 6 }]}>
          Ball above / below
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {LIE_SLOPES_SIDE.map((s) => (
            <OptChip
              key={s}
              label={slopeLabel(s)}
              on={row.lieSlopeSide === s}
              onPress={() =>
                onChange({
                  ...row,
                  lieSlopeSide:
                    row.lieSlopeSide === s ? undefined : (s as LieSlopeSide),
                })
              }
            />
          ))}
        </View>
      </View>
    </View>
  )
}

// The putt break read, unfolded inline: line (L→R / R→L / straight) + slope
// (uphill / level / downhill). Each axis toggles independently.
function BreakExpand({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  return (
    <View
      style={{
        marginTop: 9,
        backgroundColor: C.expand,
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 10,
        gap: 9,
      }}
    >
      <View>
        <Text style={[TYPE.kicker, KICKER, { color: C.mute, marginBottom: 6 }]}>
          Break — which way
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {BREAK_LINE_OPTIONS.map((o) => (
            <OptChip
              key={o.value}
              label={o.label}
              on={row.breakDirectionHorizontal === o.value}
              onPress={() =>
                onChange({
                  ...row,
                  breakDirectionHorizontal:
                    row.breakDirectionHorizontal === o.value ? undefined : o.value,
                })
              }
            />
          ))}
        </View>
      </View>
      <View>
        <Text style={[TYPE.kicker, KICKER, { color: C.mute, marginBottom: 6 }]}>
          Slope
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {BREAK_SLOPE_OPTIONS.map((o) => (
            <OptChip
              key={o.value}
              label={o.label}
              on={row.breakDirectionVertical === o.value}
              onPress={() =>
                onChange({
                  ...row,
                  breakDirectionVertical:
                    row.breakDirectionVertical === o.value ? undefined : o.value,
                })
              }
            />
          ))}
        </View>
      </View>
    </View>
  )
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
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.bg,
        zIndex: 50,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderColor: C.line,
        }}
      >
        <Text style={[TYPE.kicker, KICKER, { color: C.mute, marginBottom: 4 }]}>
          Shot {row.shotNumber} · read the green
        </Text>
        <Text style={[TYPE.serif, { color: C.ink, fontSize: 22 }]}>Aim & break</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingVertical: 18 }}
      >
        <GreenDiagram
          distanceFt={distanceFt}
          aimOffsetInches={row.aimOffsetInches ?? 0}
          breakDirection={breakDirection}
          onAimChange={(n) =>
            onChange({
              ...row,
              aimOffsetInches: n,
              breakDirectionHorizontal:
                horizontalBreakFromAim(n) ?? row.breakDirectionHorizontal,
            })
          }
        />
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: insets.bottom + 18,
          borderTopWidth: 1,
          borderColor: C.line,
        }}
      >
        <PressableTouch
          accessibilityRole="button"
          accessibilityLabel="Save read"
          onPress={onClose}
          style={{
            backgroundColor: C.accent,
            borderRadius: 2,
            paddingVertical: 12,
            paddingHorizontal: 18,
            alignItems: 'center',
          }}
        >
          <Text
            style={[
              TYPE.bodyBold,
              { color: C.accentInk, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
            ]}
          >
            Save read
          </Text>
        </PressableTouch>
      </View>
    </View>
  )
}

function PuttMissAxes({
  row,
  onChange,
}: {
  row: ReviewedShotRow
  onChange: (next: ReviewedShotRow) => void
}) {
  return (
    <View style={{ gap: 8, width: '100%' }}>
      <AxisRow
        label="Distance"
        options={PUTT_DISTANCE_OPTIONS}
        value={row.puttDistanceResult}
        onSelect={(v) =>
          onChange({
            ...row,
            puttDistanceResult: row.puttDistanceResult === v ? undefined : v,
          })
        }
      />
      <AxisRow
        label="Direction"
        options={PUTT_DIRECTION_OPTIONS}
        value={row.puttDirectionResult}
        onSelect={(v) =>
          onChange({
            ...row,
            puttDirectionResult: row.puttDirectionResult === v ? undefined : v,
          })
        }
      />
    </View>
  )
}

function AxisRow<V extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: readonly { value: V; label: string }[]
  value: V | undefined
  onSelect: (v: V) => void
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Text style={[TYPE.kicker, KICKER, { minWidth: 72, color: '#5C6356' }]}>
        {label}
      </Text>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <PressableTouch
            key={opt.value}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(opt.value)}
            style={{
              backgroundColor: active ? C.accent : C.expand,
              borderRadius: 2,
              paddingVertical: 6,
              paddingHorizontal: 10,
            }}
          >
            <Text
              style={[
                TYPE.body,
                {
                  color: active ? C.surface : C.ink,
                  fontSize: 12,
                  fontWeight: active ? '500' : '400',
                },
              ]}
            >
              {opt.label}
            </Text>
          </PressableTouch>
        )
      })}
    </View>
  )
}
