import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEFAULT_HANDICAP, bearingDegrees, destinationYards } from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { distanceYards } from '../../lib/maps'
import { FONT, TYPE } from '../../lib/typography'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HoleMap, type LatLng } from './HoleMap'
import type { HoleMapPhase } from './HoleMap.types'
import { PUTTING_RADIUS_YARDS } from './hole/types'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

// Debounce window for persisting an aim drag. The aim handle fires updates
// at ~25 Hz while dragging (HoleMap throttles to 40ms); we keep the marker
// tracking the finger locally and only write the settled position.
const AIM_PERSIST_DEBOUNCE_MS = 500

// Past-round placement only places geometry — the start position of each
// shot and (optionally) its aim. All shot *details* (club, lie, result,
// putt axes) are edited on the scorecard sheet. Distances are derived from
// the placed start → pin and stored so the SG pass needs no recompute. This
// deliberately reuses HoleMap (the renderer) but NOT LiveRoundSession (the
// live GPS state machine) — see #514.
interface PlacedShot {
  id: string | null
  shotNumber: number
  start: LatLng | null
  aim: LatLng | null
}

type PlacementMode = Extract<HoleMapPhase, 'PLACE_BALL' | 'SET_AIM' | 'PIN'>

// Half-width of the tee box (each dot sits this far to either side of the
// tee shot, perpendicular to the line of play). ~4 yd ≈ a real teeing ground.
const TEE_BOX_HALF_YARDS = 4

interface PastRoundMapProps {
  roundId: string
  userId: string
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  shots: ShotRow[]
  courseCenter: LatLng | null
  holeNumber: number
  onHoleChange: (next: number) => void
  onShotUpserted: (shot: ShotRow) => void
  onShotRemoved: (shotId: string) => void
  onHoleScoreChanged: (holeScore: HoleScoreRow) => void
}

const OKC_FALLBACK: LatLng = { lat: 35.5, lng: -97.5 }

export function PastRoundMap({
  roundId,
  userId,
  holes,
  holeScores,
  shots,
  courseCenter,
  holeNumber,
  onHoleChange,
  onShotUpserted,
  onShotRemoved,
  onHoleScoreChanged,
}: PastRoundMapProps) {
  const insets = useSafeAreaInsets()

  const currentHole = useMemo(
    () => holes.find((h) => h.number === holeNumber) ?? null,
    [holes, holeNumber],
  )
  const currentHoleScore = useMemo(
    () =>
      currentHole
        ? holeScores.find((hs) => hs.hole_id === currentHole.id) ?? null
        : null,
    [holeScores, currentHole],
  )

  const storedPin: LatLng | null = useMemo(
    () =>
      currentHole?.pin_lat != null && currentHole?.pin_lng != null
        ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
        : null,
    [currentHole],
  )
  const roundPin: LatLng | null = useMemo(
    () =>
      currentHoleScore?.pin_lat != null && currentHoleScore?.pin_lng != null
        ? { lat: currentHoleScore.pin_lat, lng: currentHoleScore.pin_lng }
        : null,
    [currentHoleScore],
  )
  const effectivePin = roundPin ?? storedPin
  const tee: LatLng | null = useMemo(
    () =>
      currentHole?.tee_lat != null && currentHole?.tee_lng != null
        ? { lat: currentHole.tee_lat, lng: currentHole.tee_lng }
        : null,
    [currentHole],
  )
  const center = effectivePin ?? tee ?? courseCenter ?? OKC_FALLBACK

  const [placed, setPlaced] = useState<PlacedShot[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [mode, setMode] = useState<PlacementMode>('PLACE_BALL')
  // When set (a shot index), the "On the green?" prompt is showing for a ball
  // just placed within putting range (mirrors the live round's prompt). Yes
  // marks it a putt + advances; No drops into aiming. Putt DETAILS (made /
  // short-long / left-right / break) are edited on the scorecard
  // (PastHoleShotsSheet), web-parity — never inline here.
  const [greenPromptIdx, setGreenPromptIdx] = useState<number | null>(null)
  const aimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear a pending aim-debounce on unmount (e.g. switching to the Scorecard
  // tab mid-drag) so it can't fire a write against a torn-down component.
  useEffect(() => {
    return () => {
      if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    }
  }, [])

  // Re-seed the placement list whenever the hole changes (NOT on every
  // shots-prop change, which would clobber an in-progress placement). The
  // ref tracks which hole_score we've seeded so a parent shots update from
  // our own persist doesn't reset the user's work.
  const seededForRef = useRef<string | null>(null)
  useEffect(() => {
    const key = currentHoleScore?.id ?? `none-${holeNumber}`
    const hsId = currentHoleScore?.id
    const existing = hsId
      ? shots
          .filter(
            (s) => s.hole_score_id === hsId && s.start_lat != null && s.start_lng != null,
          )
          .sort((a, b) => a.shot_number - b.shot_number)
          .map<PlacedShot>((s) => ({
            id: s.id,
            shotNumber: s.shot_number,
            start: { lat: s.start_lat as number, lng: s.start_lng as number },
            aim:
              s.aim_lat != null && s.aim_lng != null
                ? { lat: s.aim_lat, lng: s.aim_lng }
                : null,
          }))
      : []
    if (seededForRef.current === key) {
      // `shots` load AFTER `hole_scores` (parent's useFocusEffect), so the
      // first seed for a hole can land before the real shots arrive → an
      // empty draft. Adopt the real shots when they show up, but ONLY while
      // the user hasn't started placing (every entry still an un-persisted
      // draft) so our own persist writes never clobber in-progress work.
      // Once adopted, `placed` has ids → this branch is a no-op (loop-safe).
      if (existing.length > 0 && placed.every((s) => s.id == null)) {
        setPlaced(existing)
        setActiveIdx(existing.length - 1)
        setMode('PLACE_BALL')
      }
      return
    }
    seededForRef.current = key
    const seeded =
      existing.length > 0
        ? existing
        : [{ id: null, shotNumber: 1, start: null, aim: null }]
    setPlaced(seeded)
    setActiveIdx(seeded.length - 1)
    setMode('PLACE_BALL')
  }, [currentHoleScore?.id, holeNumber, shots, placed])

  const active = placed[activeIdx] ?? null
  const previousStarts = useMemo(
    () =>
      placed
        .slice(0, activeIdx)
        .map((s) => s.start)
        .filter((p): p is LatLng => p != null),
    [placed, activeIdx],
  )

  const startedCount = useMemo(
    () => placed.filter((s) => s.start != null).length,
    [placed],
  )

  // Tee box = two dots flanking the tee shot, perpendicular to the line of
  // play, so you place the drive between them. The tee IS where you hit shot
  // 1, so it's derived from the first placed shot (falling back to the stored
  // course tee until one is placed), oriented toward that shot's aim, then the
  // pin. No separate placement / storage — nothing to "move," so no round-state
  // gating needed.
  const teeBox = useMemo<[LatLng, LatLng] | null>(() => {
    const origin = placed[0]?.start ?? tee
    if (!origin) return null
    const toward = placed[0]?.aim ?? effectivePin
    const heading = toward
      ? bearingDegrees(origin.lat, origin.lng, toward.lat, toward.lng)
      : 0
    return [
      destinationYards(origin, heading - 90, TEE_BOX_HALF_YARDS),
      destinationYards(origin, heading + 90, TEE_BOX_HALF_YARDS),
    ]
  }, [placed, tee, effectivePin])

  // Keep hole_scores.score honest with the placed-shot count (a placed shot
  // IS a stroke). Pure score-only entry on the scorecard is untouched —
  // this only fires when the map owns shot creation for the hole.
  async function syncScore(count: number) {
    if (!currentHoleScore) return
    const { data, error } = await supabase
      .from('hole_scores')
      .update({ score: count })
      .eq('id', currentHoleScore.id)
      .eq('round_id', roundId)
      .select()
      .single()
    if (!error && data) onHoleScoreChanged(data as HoleScoreRow)
  }

  async function persistShotAt(
    idx: number,
    next: { start?: LatLng | null; aim?: LatLng | null },
  ) {
    if (!currentHoleScore) return
    const shot = placed[idx]
    if (!shot) return
    const start = next.start !== undefined ? next.start : shot.start
    const aim = next.aim !== undefined ? next.aim : shot.aim
    if (!start) return
    const distance = effectivePin
      ? Math.round(distanceYards(start, effectivePin))
      : null
    const row = {
      hole_score_id: currentHoleScore.id,
      user_id: userId,
      shot_number: shot.shotNumber,
      start_lat: start.lat,
      start_lng: start.lng,
      aim_lat: aim?.lat ?? null,
      aim_lng: aim?.lng ?? null,
      distance_to_target: distance,
    }
    if (shot.id) {
      const { data, error } = await supabase
        .from('shots')
        .update(row)
        .eq('id', shot.id)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) {
        Alert.alert('Save failed', error.message)
        return
      }
      if (data) onShotUpserted(data as ShotRow)
    } else {
      const { data, error } = await supabase
        .from('shots')
        .insert(row)
        .select()
        .single()
      if (error) {
        Alert.alert('Save failed', error.message)
        return
      }
      if (data) {
        const saved = data as ShotRow
        setPlaced((prev) =>
          prev.map((s, i) => (i === idx ? { ...s, id: saved.id } : s)),
        )
        onShotUpserted(saved)
        // Count idx as started: the closure `placed` predates this shot's
        // start being set, so filtering it directly under-counts by one
        // (the score off-by-one — every hole read one stroke low). See #514 QA.
        await syncScore(
          placed.filter((s, i) => (i === idx ? true : s.start != null)).length,
        )
      }
    }
  }

  async function handleSetBall(loc: LatLng) {
    const wasInitial = active?.start == null
    setPlaced((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, start: loc } : s)),
    )
    // Await the placement INSERT so the row + id exist before any follow-up
    // (a putt confirmation may update it). Only branch on the FIRST placement.
    await persistShotAt(activeIdx, { start: loc })
    if (!wasInitial) return
    // Within putting range of the pin → ask "On the green?" (mirrors the live
    // prompt) instead of forcing aim or an inline detail sheet. A putt skips
    // aiming entirely; a non-putt goes to aim as usual.
    if (effectivePin && distanceYards(loc, effectivePin) <= PUTTING_RADIUS_YARDS) {
      setGreenPromptIdx(activeIdx)
    } else {
      setMode('SET_AIM')
    }
  }

  // "On the green?" → Yes: it's a putt. Mark lie/club + pre-fill the putt
  // distance (start→pin) so the scorecard's putt editor is ready, then advance
  // to a fresh shot so the next ball can be placed. NO aim, NO inline details —
  // made / short-long / left-right / break are set on the scorecard.
  async function handleGreenYes() {
    const idx = greenPromptIdx
    setGreenPromptIdx(null)
    if (idx == null) return
    const shot = placed[idx]
    if (shot?.id) {
      const distFt =
        shot.start && effectivePin
          ? Math.round(distanceYards(shot.start, effectivePin) * 3)
          : null
      const { data, error } = await supabase
        .from('shots')
        .update({ lie_type: 'green', club: 'putter', putt_distance_ft: distFt })
        .eq('id', shot.id)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) {
        Alert.alert('Save failed', error.message)
        return
      }
      if (data) onShotUpserted(data as ShotRow)
    }
    // Advance to the next shot (reuses the +Shot path) so you can place the
    // next ball immediately.
    handleAddShot()
  }

  // "On the green?" → No: not a putt (chip / bunker / fringe). Aim as usual.
  function handleGreenNo() {
    setGreenPromptIdx(null)
    setMode('SET_AIM')
  }

  function handleSetAim(loc: LatLng) {
    setPlaced((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, aim: loc } : s)),
    )
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    aimTimerRef.current = setTimeout(() => {
      persistShotAt(activeIdx, { aim: loc })
    }, AIM_PERSIST_DEBOUNCE_MS)
  }

  async function handleSetPin(loc: LatLng) {
    if (!currentHoleScore) return
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    const { data, error } = await supabase
      .from('hole_scores')
      .update({ pin_lat: loc.lat, pin_lng: loc.lng })
      .eq('id', currentHoleScore.id)
      .eq('round_id', roundId)
      .select()
      .single()
    if (error) {
      Alert.alert('Pin save failed', error.message)
      return
    }
    if (data) onHoleScoreChanged(data as HoleScoreRow)
    setMode('PLACE_BALL')
  }

  function handleAddShot() {
    if (!active?.start) return // don't stack two empty drafts
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    setPlaced((prev) => [
      ...prev,
      { id: null, shotNumber: prev.length + 1, start: null, aim: null },
    ])
    setActiveIdx(placed.length)
    setMode('PLACE_BALL')
  }

  async function handleRemoveShot() {
    if (!active) return
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    if (active.id) {
      const { error } = await supabase
        .from('shots')
        .delete()
        .eq('id', active.id)
        .eq('user_id', userId)
      if (error) {
        Alert.alert('Remove failed', error.message)
        return
      }
      onShotRemoved(active.id)
    }
    const nextPlaced = placed.filter((_, i) => i !== activeIdx)
    const ensured =
      nextPlaced.length > 0
        ? nextPlaced.map((s, i) => ({ ...s, shotNumber: i + 1 }))
        : [{ id: null, shotNumber: 1, start: null, aim: null }]
    setPlaced(ensured)
    setActiveIdx(Math.max(0, ensured.length - 1))
    setMode('PLACE_BALL')
    await syncScore(ensured.filter((s) => s.start != null).length)
  }

  function goToHole(next: number) {
    if (next < 1 || next > holes.length) return
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    onHoleChange(next)
  }

  const par = currentHole?.par ?? null

  return (
    <View style={{ flex: 1, backgroundColor: '#1C211C' }}>
      {/* Hole nav strip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1C211C',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(242,238,229,0.12)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous hole"
          disabled={holeNumber <= 1}
          onPress={() => goToHole(holeNumber - 1)}
          hitSlop={10}
          style={{ padding: 6, opacity: holeNumber <= 1 ? 0.35 : 1 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.75)' }}>‹ Prev</Text>
        </Pressable>
        <Text
          style={[TYPE.serif, {
            color: '#F2EEE5',
            fontSize: 16,
            fontStyle: 'italic',
            fontWeight: '500',
          }]}
        >
          Hole {holeNumber}
          {par != null ? ` · Par ${par}` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next hole"
          disabled={holeNumber >= holes.length}
          onPress={() => goToHole(holeNumber + 1)}
          hitSlop={10}
          style={{ padding: 6, opacity: holeNumber >= holes.length ? 0.35 : 1 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.75)' }}>Next ›</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={storedPin}
          roundPin={roundPin}
          tee={tee}
          teeBox={teeBox}
          aim={active?.aim ?? null}
          ball={active?.start ?? null}
          previousShots={previousStarts}
          phase={mode}
          missingHoleLayout={!effectivePin && !tee}
          gpsPosition={null}
          courseCenter={courseCenter}
          holeNumber={holeNumber}
          onSetAim={handleSetAim}
          onSetBall={handleSetBall}
          onPlacePin={handleSetPin}
          showLocationPuck={false}
          overlayMode="tee"
          arcWidthYards={0}
          circleRadiusYards={0}
          dotsVisible={false}
          dispersionPoints={null}
          handicap={DEFAULT_HANDICAP}
        />
      </View>

      {/* Bottom controls */}
      <View
        style={{
          backgroundColor: '#1C211C',
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(242,238,229,0.12)',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ModeChip
            label="Ball"
            active={mode === 'PLACE_BALL'}
            onPress={() => setMode('PLACE_BALL')}
          />
          <ModeChip
            label="Aim"
            active={mode === 'SET_AIM'}
            disabled={!active?.start}
            onPress={() => setMode('SET_AIM')}
          />
          <ModeChip label="Pin" active={mode === 'PIN'} onPress={() => setMode('PIN')} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove this shot"
            onPress={handleRemoveShot}
            disabled={!active?.start && placed.length <= 1}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: 'rgba(242,238,229,0.3)',
              borderRadius: 2,
              opacity: !active?.start && placed.length <= 1 ? 0.4 : 1,
            }}
          >
            <Text style={{ ...KICKER, color: '#E0B7AC' }}>Remove</Text>
          </Pressable>
          <Text
            style={[TYPE.kicker, {
              flex: 1,
              textAlign: 'center',
              color: 'rgba(242,238,229,0.7)',
              fontSize: 12,
              fontVariant: ['tabular-nums'],
            }]}
          >
            {startedCount === 0
              ? 'Tap the map to place shot 1'
              : `${startedCount} shot${startedCount === 1 ? '' : 's'} placed`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add another shot"
            onPress={handleAddShot}
            disabled={!active?.start}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: !active?.start ? '#3A4138' : '#2E7D52',
              borderRadius: 2,
              opacity: !active?.start ? 0.5 : 1,
            }}
          >
            <Text style={{ ...KICKER, color: '#F2EEE5' }}>+ Shot</Text>
          </Pressable>
        </View>
      </View>

      {/* "On the green?" — mirrors the live round prompt. Yes → it's a putt
          (no aim, details on the scorecard); No → aim as a chip/bunker shot. */}
      <ConfirmDialog
        visible={greenPromptIdx != null}
        title="On the green?"
        message="Within 30 yd of the pin — were you putting, or chipping/in a bunker?"
        confirmLabel="Yes, I'm putting"
        cancelLabel="No"
        onConfirm={handleGreenYes}
        onCancel={handleGreenNo}
      />
    </View>
  )
}

function ModeChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 2,
        backgroundColor: active ? '#F2EEE5' : 'transparent',
        borderWidth: 1,
        borderColor: active ? '#F2EEE5' : 'rgba(242,238,229,0.3)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          ...KICKER,
          color: active ? '#1C211C' : 'rgba(242,238,229,0.8)',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
