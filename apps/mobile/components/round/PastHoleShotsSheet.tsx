import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { PressableTouch } from '../ui/PressableTouch'
import {
  DEFAULT_BAG,
  LIE_SLOPES_FORWARD,
  LIE_SLOPES_SIDE,
  LIE_TYPE_LABELS,
  LIE_TYPES,
  SHOT_RESULTS,
  combinedBreakDirection,
  combinedPuttResult,
  formatClubLabel,
  formatDistance,
  type BreakDirectionHorizontal,
  type BreakDirectionVertical,
  type DistanceUnit,
  type GreenSpeed,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type PuttDirectionResult,
  type PuttDistanceResult,
  type ShotResult,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useUserBag } from '../../hooks/useUserBag'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FONT, TYPE } from '../../lib/typography'

type ShotRow = Database['public']['Tables']['shots']['Row']
type ShotUpdate = Database['public']['Tables']['shots']['Update']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

const SHOT_RESULT_LABELS: Record<ShotResult, string> = {
  solid: 'Solid',
  push_right: 'Push R',
  pull_left: 'Pull L',
  fat: 'Fat',
  thin: 'Thin',
  shank: 'Shank',
  topped: 'Topped',
  penalty: 'Penalty',
  ob: 'OB',
}

const FORWARD_LABELS: Record<LieSlopeForward, string> = {
  uphill: 'Uphill',
  level: 'Level',
  downhill: 'Downhill',
}
const SIDE_LABELS: Record<LieSlopeSide, string> = {
  ball_above: 'Ball above',
  ball_below: 'Ball below',
}
const GREEN_SPEEDS: GreenSpeed[] = ['slow', 'medium', 'fast']
const GREEN_SPEED_LABELS: Record<GreenSpeed, string> = {
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
}
const BREAK_V: BreakDirectionVertical[] = ['uphill', 'downhill', 'flat']
const BREAK_V_LABELS: Record<BreakDirectionVertical, string> = {
  uphill: 'Uphill',
  downhill: 'Downhill',
  flat: 'Flat',
}
const BREAK_H: BreakDirectionHorizontal[] = ['left_to_right', 'right_to_left', 'straight']
const BREAK_H_LABELS: Record<BreakDirectionHorizontal, string> = {
  left_to_right: 'L → R',
  right_to_left: 'R → L',
  straight: 'Straight',
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!error && data) {
      onShotUpdated?.(data as ShotRow)
      // next set by the editor's prev/next nav; null closes the editor.
      setEditingShot(next ?? null)
    }
  }

  // One <Modal> with discriminated content (list vs editor) — NOT two
  // sibling Modals. iOS allows one presented modal per presenter, so the
  // old stacked-Modal edit flow silently failed to present (#293/#495).
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={editingShot ? () => setEditingShot(null) : onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={editingShot ? () => setEditingShot(null) : onClose}
        />
        {editingShot ? (
          <EditShotSheet
            key={editingShot.id}
            shot={editingShot}
            allShots={sortedShots}
            clubs={clubs}
            saving={saving}
            onSave={(updates, next) => handleSave(editingShot.id, updates, next)}
            onClose={() => setEditingShot(null)}
          />
        ) : (
          <View
            style={{
              backgroundColor: '#FBF8F1',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              paddingHorizontal: 18,
              paddingTop: 14,
              paddingBottom: insets.bottom + 28,
              maxHeight: '80%',
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 32,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#D9D2BF',
                marginBottom: 14,
              }}
            />
            <Text style={{ ...KICKER, marginBottom: 4 }}>
              Hole {holeNumber ?? '—'}
              {par != null ? ` · Par ${par}` : ''}
            </Text>
            <Text
              style={[TYPE.serif, {
                color: '#1C211C',
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: '500',
                marginBottom: 14,
              }]}
            >
              {sortedShots.length} shot{sortedShots.length === 1 ? '' : 's'}
            </Text>

            {sortedShots.length === 0 ? (
              <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, lineHeight: 20 }]}>
                No shots logged for this hole. Place them on the Map tab, then
                edit their details here.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: '85%' }}>
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close hole shots"
              onPress={onClose}
              style={{
                marginTop: 14,
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#D9D2BF',
                borderRadius: 2,
              }}
            >
              <Text style={{ ...KICKER, color: '#5C6356' }}>Close</Text>
            </Pressable>
          </View>
        )}
      </View>
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
  const isPutt = shot.lie_type === 'green' || shot.club === 'putter'
  const clubLabel = isPutt
    ? 'Putt'
    : shot.club
      ? formatClubLabel({ club_type: shot.club })
      : '—'
  const lieLabel = shot.lie_type ? LIE_TYPE_LABELS[shot.lie_type as LieType] : null
  const distanceLabel =
    shot.distance_to_target != null ? formatDistance(shot.distance_to_target, unit) : null
  const sub = isPutt
    ? [
        shot.putt_distance_ft != null ? `${shot.putt_distance_ft} ft` : null,
        shot.putt_result === 'made'
          ? 'Made'
          : [shot.putt_distance_result, shot.putt_direction_result]
              .filter(Boolean)
              .join(' '),
      ]
        .filter(Boolean)
        .join(' · ')
    : [lieLabel, distanceLabel].filter(Boolean).join(' · ')

  return (
    <PressableTouch
      android_ripple={{ color: '#EBE5D6' }}
      accessibilityRole="button"
      accessibilityLabel={`Edit shot ${shot.shot_number}: ${clubLabel}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#EBE5D6',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Text style={[TYPE.kicker, { width: 24, color: '#8A8B7E', fontSize: 14, fontVariant: ['tabular-nums'] }]}>
        {shot.shot_number}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.bodyBold, { color: '#1C211C', fontSize: 15, fontWeight: '500', textTransform: 'capitalize' }]}>
          {clubLabel}
        </Text>
        {sub.length > 0 && (
          <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12, marginTop: 2 }]}>
            {sub}
          </Text>
        )}
      </View>
      <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 12 }]}>Edit</Text>
    </PressableTouch>
  )
}

interface EditShotSheetProps {
  shot: ShotRow
  allShots: ShotRow[]
  clubs: readonly { club_type: string; name?: string | null }[]
  saving: boolean
  onSave: (updates: ShotUpdate, next?: ShotRow | null) => void
  onClose: () => void
}

// Reusable horizontal chip selector — the editor has ~10 of these so a
// shared row keeps it readable.
function ChipRow<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onSelect: (v: T) => void
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ ...KICKER, marginBottom: 8 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {options.map((o) => {
            const active = value === o.value
            return (
              <Pressable
                key={o.value}
                onPress={() => onSelect(o.value)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 2,
                  backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
                }}
              >
                <Text style={[TYPE.body, { color: active ? '#F2EEE5' : '#1C211C', fontSize: 12 }]}>
                  {o.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

function EditShotSheet({
  shot,
  allShots,
  clubs,
  saving,
  onSave,
  onClose,
}: EditShotSheetProps) {
  const insets = useSafeAreaInsets()
  const [club, setClub] = useState<string | null>(shot.club ?? null)
  const [lieType, setLieType] = useState<LieType | null>(
    (shot.lie_type as LieType | null) ?? null,
  )
  const [shotResult, setShotResult] = useState<ShotResult | null>(
    (shot.shot_result as ShotResult | null) ?? null,
  )
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

  const isPutt = lieType === 'green'

  const idx = allShots.findIndex((s) => s.id === shot.id)
  const prevShot = idx > 0 ? allShots[idx - 1]! : null
  const nextShot =
    idx >= 0 && idx < allShots.length - 1 ? allShots[idx + 1]! : null

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
      shot_result: shotResult,
      penalty: shotResult === 'penalty',
      ob: shotResult === 'ob',
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

  function handleSavePress() {
    onSave(buildUpdates())
  }

  return (
    <View
      style={{
        backgroundColor: '#FBF8F1',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: insets.bottom + 28,
        maxHeight: '90%',
      }}
    >
      <View
        style={{
          alignSelf: 'center',
          width: 32,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#D9D2BF',
          marginBottom: 14,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous shot"
          accessibilityState={{ disabled: !prevShot || saving }}
          disabled={!prevShot || saving}
          onPress={() => onSave(buildUpdates(), prevShot)}
          hitSlop={8}
          style={{ padding: 4, opacity: prevShot ? 1 : 0.3 }}
        >
          <Text style={{ ...KICKER, color: '#5C6356' }}>‹ Prev</Text>
        </Pressable>
        <Text
          style={[TYPE.serif, {
            color: '#1C211C',
            fontSize: 17,
            fontStyle: 'italic',
            fontWeight: '500',
          }]}
        >
          Shot {shot.shot_number}
          {allShots.length > 1 ? ` of ${allShots.length}` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next shot"
          accessibilityState={{ disabled: !nextShot || saving }}
          disabled={!nextShot || saving}
          onPress={() => onSave(buildUpdates(), nextShot)}
          hitSlop={8}
          style={{ padding: 4, opacity: nextShot ? 1 : 0.3 }}
        >
          <Text style={{ ...KICKER, color: '#5C6356' }}>Next ›</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ChipRow
          label="Lie"
          options={LIE_TYPES.map((lt) => ({ value: lt, label: LIE_TYPE_LABELS[lt] }))}
          value={lieType}
          onSelect={(lt) => setLieType(lt)}
        />

        {isPutt ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              <ResultToggle label="Made" active={puttMade} onPress={() => setPuttMade(true)} />
              <ResultToggle label="Missed" active={!puttMade} onPress={() => setPuttMade(false)} />
            </View>

            <Text style={{ ...KICKER, marginBottom: 8 }}>Putt distance (ft)</Text>
            <TextInput
              value={puttDistanceFt}
              onChangeText={(t) => setPuttDistanceFt(t.replace(/[^0-9]/g, '').slice(0, 3))}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor="#C4BCA8"
              accessibilityLabel="Putt distance in feet"
              style={[TYPE.body, {
                backgroundColor: '#EBE5D6',
                borderRadius: 2,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                color: '#1C211C',
                marginBottom: 18,
              }]}
            />

            {!puttMade && (
              <>
                <ChipRow
                  label="Miss — distance"
                  options={[
                    { value: 'short' as PuttDistanceResult, label: 'Short' },
                    { value: 'long' as PuttDistanceResult, label: 'Long' },
                  ]}
                  value={distanceResult}
                  onSelect={(v) => setDistanceResult(v)}
                />
                <ChipRow
                  label="Miss — direction"
                  options={[
                    { value: 'left' as PuttDirectionResult, label: 'Left' },
                    { value: 'right' as PuttDirectionResult, label: 'Right' },
                  ]}
                  value={directionResult}
                  onSelect={(v) => setDirectionResult(v)}
                />
              </>
            )}

            <ChipRow
              label="Green speed"
              options={GREEN_SPEEDS.map((g) => ({ value: g, label: GREEN_SPEED_LABELS[g] }))}
              value={greenSpeed}
              onSelect={(v) => setGreenSpeed(v)}
            />
            <ChipRow
              label="Break — vertical"
              options={BREAK_V.map((b) => ({ value: b, label: BREAK_V_LABELS[b] }))}
              value={breakV}
              onSelect={(v) => setBreakV(v)}
            />
            <ChipRow
              label="Break — horizontal"
              options={BREAK_H.map((b) => ({ value: b, label: BREAK_H_LABELS[b] }))}
              value={breakH}
              onSelect={(v) => setBreakH(v)}
            />
          </>
        ) : (
          <>
            <ChipRow
              label="Club"
              options={clubs.map((c) => ({
                value: c.club_type,
                label: formatClubLabel({ club_type: c.club_type }),
              }))}
              value={club}
              onSelect={(v) => setClub(v)}
            />
            <ChipRow
              label="Lie slope — forward"
              options={LIE_SLOPES_FORWARD.map((s) => ({ value: s, label: FORWARD_LABELS[s] }))}
              value={slopeForward}
              onSelect={(v) => setSlopeForward(v)}
            />
            <ChipRow
              label="Lie slope — side"
              options={LIE_SLOPES_SIDE.map((s) => ({ value: s, label: SIDE_LABELS[s] }))}
              value={slopeSide}
              onSelect={(v) => setSlopeSide(v)}
            />
            <ChipRow
              label="Result"
              options={SHOT_RESULTS.map((r) => ({ value: r, label: SHOT_RESULT_LABELS[r] }))}
              value={shotResult}
              onSelect={(v) => setShotResult(v)}
            />
          </>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
          }}
        >
          <Text style={{ ...KICKER, color: '#5C6356' }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save shot edits"
          disabled={saving}
          onPress={handleSavePress}
          style={{
            flex: 2,
            paddingVertical: 12,
            alignItems: 'center',
            backgroundColor: saving ? '#5C6356' : '#1F3D2C',
            borderRadius: 2,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ ...KICKER, color: '#F2EEE5' }}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ResultToggle({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 2,
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
      }}
    >
      <Text style={[TYPE.body, { color: active ? '#F2EEE5' : '#1C211C', fontSize: 13 }]}>
        {label}
      </Text>
    </Pressable>
  )
}
