import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useSwipeToDismiss } from '../ui/useSwipeToDismiss'
import {
  DEFAULT_BAG,
  LIE_TYPE_LABELS,
  LIE_TYPES,
  combinedBreakDirection,
  combinedPuttResult,
  formatClubLabel,
  formatDistance,
  formatPuttDistance,
  isPuttShot,
  legacyShotResult,
  shotAxesFromLegacy,
  summarizeShotParts,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type DistanceUnit,
  type GreenSpeed,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ShotContact,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useUserBag } from '../../hooks/useUserBag'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TYPE } from '../../lib/typography'
import { Key, KeyText, PaperSurface, Rocker } from '../paper/Paper'
import {
  ClubPicker,
  PickerField,
  ResultPicker,
  RockerRows,
  SlopeGrid,
  useStackedLabels,
  type Opt,
  type ResultValue,
} from '../paper/Pickers'
import { Icon } from '../paper/icons'
import { FONT_CAP, GAP, P, R } from '../paper/tokens'

type ShotRow = Database['public']['Tables']['shots']['Row']
type ShotUpdate = Database['public']['Tables']['shots']['Update']

// Putt vocab mirrors the live hole-review sheet so the two surfaces read alike.
const PUTT_DISTANCE_OPTIONS: Opt<PuttDistanceResult>[] = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
]
const PUTT_DIRECTION_OPTIONS: Opt<PuttDirectionResult>[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]
const SPEED_OPTIONS: Opt<GreenSpeed>[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]
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

interface PastHoleShotsSheetProps {
  visible: boolean
  holeNumber: number | null
  par: number | null
  shots: ShotRow[]
  unit: DistanceUnit
  /**
   * When set (and `visible`), opens straight into this shot's editor rather
   * than the shot list — the past-round map's "Edit this shot" entry (#593).
   * Null/undefined → opens to the list (scorecard drill-down).
   */
  initialShotId?: string | null
  onClose: () => void
  onShotUpdated?: (shot: ShotRow) => void
}

// Paper sheet chrome (#611 §19.6): chrome + grain, square top corners, one
// ink top border. The scrim sits behind it in the Modal.
const SHEET = {
  borderTopWidth: 1,
  borderColor: P.ink,
  borderTopLeftRadius: R,
  borderTopRightRadius: R,
} as const

export function PastHoleShotsSheet({
  visible,
  holeNumber,
  par,
  shots,
  unit,
  initialShotId,
  onClose,
  onShotUpdated,
}: PastHoleShotsSheetProps) {
  const { bag } = useUserBag({ seedIfEmpty: false })
  const clubs = bag.length > 0 ? bag : DEFAULT_BAG
  const [editingShot, setEditingShot] = useState<ShotRow | null>(null)
  // Return where the player came from: opened straight into a shot (the
  // past-round map's "Edit shot N") → closing the editor closes the sheet;
  // opened on the list (scorecard "Shots ›") → back to the list.
  const closeEditor = () => (initialShotId ? onClose() : setEditingShot(null))
  const [saving, setSaving] = useState(false)
  const insets = useSafeAreaInsets()

  const sortedShots = [...shots].sort((a, b) => a.shot_number - b.shot_number)

  // On open, jump into a specific shot's editor when the map's "Edit this
  // shot" passed an id; otherwise show the list. Runs only on open / id
  // change — deliberately NOT on `shots` changes, so saving an edit (which
  // mutates `shots`) doesn't reopen the editor after it closes to the list.
  useEffect(() => {
    if (!visible) return
    setEditingShot(
      initialShotId
        ? sortedShots.find((s) => s.id === initialShotId) ?? null
        : null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortedShots intentionally omitted: re-saving shot details mutates `shots` and must not re-open the editor after it closes to the list
  }, [visible, initialShotId])

  async function handleSave(
    shotId: string,
    updates: ShotUpdate,
    next?: ShotRow | null,
  ) {
    setSaving(true)
    const { data, error } = await supabase
      .from('shots')
      .update(updates)
      .eq('id', shotId)
      .select()
      .single()
    setSaving(false)
    if (error || !data) {
      // Keep the editor open (edits intact) but say so — the sheet used to
      // just sit there, reading as a dead Save button.
      Alert.alert('Save failed', error?.message ?? 'Could not save shot')
      return
    }
    onShotUpdated?.(data as ShotRow)
    // next set by the editor's prev/next nav; none closes the editor.
    if (next) setEditingShot(next)
    else closeEditor()
  }

  // One <Modal> with discriminated content (list vs editor) — NOT two
  // sibling Modals. iOS allows one presented modal per presenter, so the
  // old stacked-Modal edit flow silently failed to present (#293/#495).
  const { pan, cardStyle } = useSwipeToDismiss(onClose, visible)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={editingShot ? closeEditor : onClose}
    >
      {/* GHRootView required for the swipe-to-dismiss pan: RN Modal is a
          separate native window on Android the app-root can't reach (#496). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      {/* iOS: padding lifts the whole bottom sheet (putt Length field + Save
          footer) above the keyboard. Android pans the window itself. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: P.scrim }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            // Tapping the scrim is how people dismiss a number pad (it has no
            // return key) — close the keyboard, don't discard the edit.
            if (Keyboard.isVisible()) Keyboard.dismiss()
            else if (editingShot) closeEditor()
            else onClose()
          }}
        />
        {editingShot ? (
          <EditShotSheet
            key={editingShot.id}
            shot={editingShot}
            allShots={sortedShots}
            holeNumber={holeNumber}
            unit={unit}
            clubs={clubs}
            saving={saving}
            onSave={(updates, next) => handleSave(editingShot.id, updates, next)}
            onClose={closeEditor}
          />
        ) : (
          <Animated.View style={[{ maxHeight: '80%' }, cardStyle]}>
            <PaperSurface style={[SHEET, { paddingBottom: insets.bottom + 12, flexShrink: 1 }]}>
              <GestureDetector gesture={pan}>
                <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: 22 }}>
                  <View style={{ flex: 1, paddingVertical: 10 }}>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 26, lineHeight: 30, color: P.ink }]}>
                      Hole {holeNumber ?? '—'}
                    </Text>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
                      {par != null ? `Par ${par} · ` : ''}
                      {sortedShots.length} shot{sortedShots.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close hole shots"
                    onPress={onClose}
                    style={{ width: 44, height: 44, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon.x size={20} />
                  </Pressable>
                </View>
              </GestureDetector>

              {sortedShots.length === 0 ? (
                <Text maxFontSizeMultiplier={FONT_CAP}
                  style={[
                    TYPE.body,
                    { color: P.ink, fontSize: 15, lineHeight: 21, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderColor: P.line },
                  ]}
                >
                  No shots logged for this hole. Place them on the Map tab, then
                  edit their details here.
                </Text>
              ) : (
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 22 }}>
                  {sortedShots.map((s) => (
                    <ShotRowView
                      key={s.id}
                      shot={s}
                      unit={unit}
                      onPress={() => setEditingShot(s)}
                    />
                  ))}
                </ScrollView>
              )}
            </PaperSurface>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}

function ShotRowView({
  shot,
  unit,
  onPress,
}: {
  shot: ShotRow
  unit: DistanceUnit
  onPress: () => void
}) {
  const isPutt = isPuttShot(shot.lie_type)
  const clubLabel = isPutt
    ? 'Putt'
    : shot.club
      ? formatClubLabel({ club_type: shot.club })
      : '—'
  const lieLabel = shot.lie_type ? LIE_TYPE_LABELS[shot.lie_type as LieType] : null
  const sub = isPutt
    ? [
        // formatPuttDistance: metres mode read "6 ft" here.
        shot.putt_distance_ft != null ? formatPuttDistance(shot.putt_distance_ft, unit) : null,
        shot.putt_result === 'made'
          ? 'Made'
          : [shot.putt_distance_result, shot.putt_direction_result]
              .filter(Boolean)
              .join(' '),
      ]
        .filter(Boolean)
        .join(' · ')
    : // Distance + the result axes ("Thin · Draw"), same helper as web's list.
      [lieLabel, ...summarizeShotParts(shot, null, unit)].filter(Boolean).join(' · ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit shot ${shot.shot_number}: ${clubLabel}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        minHeight: 56,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderColor: P.line,
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { width: 48, color: shot.ob === true ? P.neg : P.ink, fontSize: 13 }]}>
        Shot {shot.shot_number}
      </Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 20 }]}>{clubLabel}</Text>
          {shot.ob === true && (
            /* An OB shot and its stroke-and-distance re-hit sit on the same
               coordinate, so their map discs overlap and neither number is
               reliably legible. This row is the unambiguous answer to which
               shot went out of bounds (#839). */
            <Text maxFontSizeMultiplier={FONT_CAP}
              style={[
                TYPE.bodyBold,
                {
                  color: P.neg,
                  fontSize: 11,
                  borderWidth: 1.5,
                  borderColor: P.neg,
                  borderRadius: 2,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                },
              ]}
            >
              OB
            </Text>
          )}
        </View>
        {sub.length > 0 && (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 13 }]}>{sub}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 13 }]}>Edit</Text>
        <Icon.next size={14} />
      </View>
    </Pressable>
  )
}

interface EditShotSheetProps {
  shot: ShotRow
  allShots: ShotRow[]
  holeNumber: number | null
  unit: DistanceUnit
  clubs: readonly { club_type: string; name?: string | null; loft?: number | null }[]
  saving: boolean
  onSave: (updates: ShotUpdate, next?: ShotRow | null) => void
  onClose: () => void
}

// Edit-shot sheet (#611 §19.6 as amended by §19.9): P2 grouped rockers for
// every choose-one field, the fixed 3×2 slope grid, putt fields as rockers.
// Every axis is nullable, so tapping the active segment clears it — except
// Made/Missed, which is a boolean.
function EditShotSheet({
  shot,
  allShots,
  holeNumber,
  unit,
  clubs,
  saving,
  onSave,
  onClose,
}: EditShotSheetProps) {
  const insets = useSafeAreaInsets()
  const stacked = useStackedLabels()
  const [club, setClub] = useState<string | null>(shot.club ?? null)
  const [lieType, setLieType] = useState<LieType | null>(
    (shot.lie_type as LieType | null) ?? null,
  )
  // Rows saved before 0057 carry only the legacy value.
  const [result, setResult] = useState<ResultValue>(() => {
    const axes =
      shot.contact || shot.shape || shot.start_line
        ? {
            contact: (shot.contact as ShotContact | null) ?? null,
            shape: (shot.shape as ShotShape | null) ?? null,
            startLine: (shot.start_line as ShotStartLine | null) ?? null,
          }
        : shotAxesFromLegacy(shot.shot_result)
    return { ...axes, penalty: !!shot.penalty || shot.shot_result === 'penalty', ob: !!shot.ob || shot.shot_result === 'ob' }
  })
  const [slopeForward, setSlopeForward] = useState<LieSlopeForward | null>(
    (shot.lie_slope_forward as LieSlopeForward | null) ?? null,
  )
  const [slopeSide, setSlopeSide] = useState<LieSlopeSide | null>(
    (shot.lie_slope_side as LieSlopeSide | null) ?? null,
  )
  // Putt state.
  const [puttMade, setPuttMade] = useState<boolean>(shot.putt_result === 'made')
  const [puttDistanceFt, setPuttDistanceFt] = useState<string>(
    shot.putt_distance_ft != null ? String(shot.putt_distance_ft) : '',
  )
  const [distanceResult, setDistanceResult] = useState<PuttDistanceResult | null>(
    (shot.putt_distance_result as PuttDistanceResult | null) ?? null,
  )
  const [directionResult, setDirectionResult] = useState<PuttDirectionResult | null>(
    (shot.putt_direction_result as PuttDirectionResult | null) ?? null,
  )
  const [greenSpeed, setGreenSpeed] = useState<GreenSpeed | null>(
    (shot.green_speed as GreenSpeed | null) ?? null,
  )
  const [breakV, setBreakV] = useState<BreakDirectionVertical | null>(
    (shot.break_direction_vertical as BreakDirectionVertical | null) ?? null,
  )
  const [breakH, setBreakH] = useState<BreakDirectionHorizontal | null>(
    (shot.break_direction_horizontal as BreakDirectionHorizontal | null) ?? null,
  )

  const isPutt = isPuttShot(lieType)

  // The bag in its own order, plus the shot's club when it isn't in the bag,
  // so the picker always shows what was saved (same as the live review sheet).
  const clubOptions = useMemo<Opt<string>[]>(() => {
    const typeCounts = new Map<string, number>()
    for (const c of clubs) typeCounts.set(c.club_type, (typeCounts.get(c.club_type) ?? 0) + 1)
    const base = clubs.map((c) => ({
      value: c.club_type,
      label: formatClubLabel(c, { hasDuplicateType: (typeCounts.get(c.club_type) ?? 0) > 1 }),
    }))
    if (shot.club && !base.some((o) => o.value === shot.club)) {
      return [{ value: shot.club, label: formatClubLabel({ club_type: shot.club }) }, ...base]
    }
    return base
  }, [clubs, shot.club])

  const idx = allShots.findIndex((s) => s.id === shot.id)
  const prevShot = idx > 0 ? allShots[idx - 1]! : null
  const nextShot =
    idx >= 0 && idx < allShots.length - 1 ? allShots[idx + 1]! : null

  const toPin =
    isPuttShot(shot.lie_type) && shot.putt_distance_ft != null
      ? `${formatPuttDistance(shot.putt_distance_ft, unit)} to the hole`
      : shot.distance_to_target != null
        ? `${formatDistance(shot.distance_to_target, unit)} to the pin`
        : null
  const subtitle = [holeNumber != null ? `Hole ${holeNumber}` : null, toPin].filter(Boolean).join(' · ')

  function buildUpdates(): ShotUpdate {
    if (isPutt) {
      const distance = puttMade ? null : distanceResult
      const direction = puttMade ? null : directionResult
      return {
        club: 'putter',
        lie_type: 'green',
        lie_slope_forward: null,
        lie_slope_side: null,
        shot_result: null,
        contact: null,
        shape: null,
        start_line: null,
        penalty: false,
        ob: false,
        putt_distance_ft: puttDistanceFt === '' ? null : Number(puttDistanceFt),
        putt_result: combinedPuttResult({ made: puttMade, distance, direction }),
        putt_distance_result: distance,
        putt_direction_result: direction,
        green_speed: greenSpeed,
        break_direction: combinedBreakDirection({ vertical: breakV, horizontal: breakH }),
        break_direction_vertical: breakV,
        break_direction_horizontal: breakH,
      }
    }
    return {
      club,
      lie_type: lieType,
      lie_slope_forward: slopeForward,
      lie_slope_side: slopeSide,
      shot_result: legacyShotResult(result),
      contact: result.contact,
      shape: result.shape,
      start_line: result.startLine,
      penalty: result.penalty,
      ob: !!result.ob,
      // Clear putt-only columns when this isn't a putt.
      putt_distance_ft: null,
      putt_result: null,
      putt_distance_result: null,
      putt_direction_result: null,
      green_speed: null,
      break_direction: null,
      break_direction_vertical: null,
      break_direction_horizontal: null,
    }
  }

  const { pan, cardStyle } = useSwipeToDismiss(onClose)

  const lieField = (
    <PickerField title="Lie">
      <RockerRows options={LIE_TYPES.map((lt) => ({ value: lt, label: LIE_TYPE_LABELS[lt] }))} value={lieType} onChange={setLieType} />
    </PickerField>
  )

  const stepKey = (dir: 'prev' | 'next', target: ShotRow | null) => (
    <Key
      accessibilityLabel={dir === 'prev' ? 'Previous shot' : 'Next shot'}
      disabled={!target || saving}
      onPress={() => onSave(buildUpdates(), target)}
      faceStyle={{ width: 44, height: 44 }}
    >
      {dir === 'prev' ? (
        <Icon.prev size={22} color={!target || saving ? P.ink35 : P.ink} />
      ) : (
        <Icon.next size={22} color={!target || saving ? P.ink35 : P.ink} />
      )}
    </Key>
  )

  return (
    <Animated.View style={[{ maxHeight: '90%' }, cardStyle]}>
      <PaperSurface style={[SHEET, { flexShrink: 1 }]}>
        <GestureDetector gesture={pan}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingLeft: 22, paddingRight: 8, gap: GAP }}>
            <View style={{ flex: 1, minWidth: 0, paddingVertical: 10 }}>
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { fontSize: 26, lineHeight: 30, color: P.ink }]}>
                Shot {shot.shot_number}
                {allShots.length > 1 ? <Text maxFontSizeMultiplier={FONT_CAP} style={{ fontSize: 18 }}>{` of ${allShots.length}`}</Text> : null}
              </Text>
              {subtitle.length > 0 && <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>{subtitle}</Text>}
            </View>
            {stepKey('prev', prevShot)}
            {stepKey('next', nextShot)}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close shot editor"
              onPress={onClose}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon.x size={20} />
            </Pressable>
          </View>
        </GestureDetector>

        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {isPutt ? (
            <>
              {lieField}
              <PickerField title="Putt">
                <Rocker
                  options={[
                    { value: 'made', label: 'Made' },
                    { value: 'missed', label: 'Missed' },
                  ]}
                  value={puttMade ? 'made' : 'missed'}
                  onChange={(v) => v && setPuttMade(v === 'made')}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { width: 52, fontSize: 12, color: P.ink }]}>Length</Text>
                  <TextInput
                    value={puttDistanceFt}
                    onChangeText={(t) => setPuttDistanceFt(t.replace(/[^0-9]/g, '').slice(0, 3))}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={P.ink35}
                    accessibilityLabel="Putt distance in feet"
                    style={[
                      TYPE.kicker,
                      {
                        width: 80,
                        minHeight: 44,
                        paddingHorizontal: 12,
                        paddingVertical: 0,
                        fontSize: 15,
                        color: P.ink,
                        backgroundColor: P.raised,
                        borderWidth: 1,
                        borderColor: P.ink,
                        borderRadius: R,
                      },
                    ]}
                  />
                  <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.kicker, { fontSize: 14, color: P.ink }]}>ft</Text>
                </View>
              </PickerField>

              {/* Putt miss = two independent axes (CLAUDE.md) — never one picker. */}
              {!puttMade && (
                <PickerField title="Miss">
                  <RockerRows label="Distance" options={PUTT_DISTANCE_OPTIONS} value={distanceResult} onChange={setDistanceResult} stacked={stacked} />
                  <RockerRows label="Missed" options={PUTT_DIRECTION_OPTIONS} value={directionResult} onChange={setDirectionResult} stacked={stacked} />
                </PickerField>
              )}

              <PickerField title="Green speed">
                <RockerRows options={SPEED_OPTIONS} value={greenSpeed} onChange={setGreenSpeed} />
              </PickerField>
              <PickerField title="Break">
                <RockerRows label="Line" options={BREAK_LINE_OPTIONS} value={breakH} onChange={setBreakH} stacked={stacked} />
                <RockerRows label="Slope" options={BREAK_SLOPE_OPTIONS} value={breakV} onChange={setBreakV} stacked={stacked} />
              </PickerField>
            </>
          ) : (
            <>
              <PickerField title="Club">
                <ClubPicker clubs={clubOptions} value={club} onChange={setClub} />
              </PickerField>
              {lieField}
              <PickerField title="Slope">
                <SlopeGrid forward={slopeForward} side={slopeSide} onForward={setSlopeForward} onSide={setSlopeSide} />
              </PickerField>
              <ResultPicker value={result} onChange={setResult} withOb />
            </>
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            gap: GAP,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            borderTopWidth: 1,
            borderColor: P.ink,
          }}
        >
          <Key accessibilityLabel="Cancel" onPress={onClose} style={{ flex: 1 }} faceStyle={{ minHeight: 49 }}>
            <KeyText>Cancel</KeyText>
          </Key>
          <Key
            accessibilityLabel="Save shot edits"
            tone="primary"
            disabled={saving}
            onPress={() => onSave(buildUpdates())}
            style={{ flex: 1 }}
            faceStyle={{ minHeight: 49 }}
          >
            <KeyText tone="primary" bold size={16} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </KeyText>
          </Key>
        </View>
      </PaperSurface>
    </Animated.View>
  )
}
