import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import { AppState } from 'react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createKalmanState, updateKalman, type KalmanState } from '@oga/core'
import type { LatLng } from '../HoleMap'
import { distanceYards } from '../../../lib/maps'
import { PIN_PROMPT_RADIUS_YARDS, type RoundState } from './types'

// Fraction of the straight ball→pin line where the aim auto-spawns when
// the player enters SET_AIM without having dropped one yet. ~0.65 puts the
// target two-thirds up the hole — a sensible default carry the player then
// drags to refine (refs ux-09). A long-press still repositions it freely.
const AIM_AUTOSPAWN_FRACTION = 0.65

interface UseHoleStateInput {
  currentHoleId: string | null | undefined
  currentHoleScoreId: string | null | undefined
  isPastMode: boolean
  storedPin: LatLng | null
  roundPin: LatLng | null
  /** Hole's tee-box coords, used to default shot 1's ball marker so the
   *  player starts from the tee rather than an empty map. Null on holes
   *  without layout. */
  tee: LatLng | null
  /** Whether any shot has been logged on this hole yet (remote + pending).
   *  The tee default only applies on shot 1 (no prior shots). */
  hasPriorShots: boolean
}

export interface UseHoleStateResult {
  aim: LatLng | null
  setAim: Dispatch<SetStateAction<LatLng | null>>
  /** Whether the current aim was set/dragged by the player (true) vs left as
   *  the auto-spawned suggestion (false). Only a touched aim is persisted to
   *  shots.aim_lat/lng, so an untouched auto-spawn can't pollute dispersion. */
  aimTouched: boolean
  setAimTouched: Dispatch<SetStateAction<boolean>>
  ball: LatLng | null
  setBall: Dispatch<SetStateAction<LatLng | null>>
  roundState: RoundState
  setRoundState: Dispatch<SetStateAction<RoundState>>
  gpsPosition: LatLng | null
  kalmanStateRef: MutableRefObject<KalmanState | null>
  manuallyPlacedRef: MutableRefObject<boolean>
  lastSavedShotLocalIdRef: MutableRefObject<number | null>
  aimHintVisible: boolean
  setAimHintVisible: Dispatch<SetStateAction<boolean>>
  nearPin: boolean
  /** True when the player has navigated BACK to a hole that already has
   *  logged shots and has NOT yet opted into adding another shot. Live aids
   *  (auto-aim spawn, GPS ball watcher/marker, line-to-green) are suppressed
   *  while this is true — the hole shows only the existing shot breadcrumb.
   *  Pressing "Add a shot" (or marking a ball) flips it false and re-arms the
   *  live append flow. See #484 (live-round revisit). */
  isRevisitingPlayedHole: boolean
  /** Opt back into the live append flow on a revisited hole (clears
   *  isRevisitingPlayedHole for this hole visit). markBallHere also sets it so
   *  the natural shot-to-shot flow keeps the aids on. */
  setAppendEngaged: Dispatch<SetStateAction<boolean>>
}

export function useHoleState({
  currentHoleId,
  currentHoleScoreId,
  isPastMode,
  storedPin,
  roundPin,
  tee,
  hasPriorShots,
}: UseHoleStateInput): UseHoleStateResult {
  const [aim, setAim] = useState<LatLng | null>(null)
  // Auto-spawned aims start untouched; flipped true by a user drag/long-press
  // (LiveRoundSession wraps onSetAim). Reset whenever the aim clears (effect
  // below) so each new shot's suggestion starts untouched.
  const [aimTouched, setAimTouched] = useState(false)
  const [ball, setBall] = useState<LatLng | null>(null)
  // Kalman filter state for live GPS smoothing during PLACE_BALL. Held
  // in a ref because every position update would otherwise re-render
  // the entire screen at GPS cadence (1-2 Hz). Reset on hole change,
  // manual drag, or when leaving PLACE_BALL — see useEffect below.
  // Ref so the AppState listener can remove the subscription if the app
  // backgrounds while GPS is active — prevents the native callback from
  // firing into a null JS module object after the OS tears down the app.
  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null)
  const kalmanStateRef = useRef<KalmanState | null>(null)
  // Set true the moment the player manually drags or taps the ball;
  // freezes the GPS callback's setBall so the next reading can't
  // clobber the manual placement.
  const manuallyPlacedRef = useRef(false)
  // local_id of the just-saved pending shot, so the next PLACE_BALL
  // can fill in that shot's end_lat/end_lng with the new ball position.
  const lastSavedShotLocalIdRef = useRef<number | null>(null)
  const [roundState, setRoundState] = useState<RoundState>('PLACE_BALL')
  const [gpsPosition, setGpsPosition] = useState<LatLng | null>(null)
  const [gpsNonce, setGpsNonce] = useState(0)
  // First-use hint that "aim point = start line, drag to adjust." Gated
  // by AsyncStorage so it only appears the first time the player ever
  // sets an aim point on this device, then auto-dismisses after 3s.
  const [aimHintVisible, setAimHintVisible] = useState(false)
  // Set true once the player engages the live append flow on this hole visit —
  // via "Add a shot" or by marking a ball. Reset on hole change. Anchoring to an
  // in-visit action (not an entry-time shot-count snapshot) sidesteps the async
  // shot-count load: hasPriorShots can arrive a beat late without flipping it.
  const [appendEngaged, setAppendEngaged] = useState(false)
  const isRevisitingPlayedHole = hasPriorShots && !appendEngaged

  // First-aim hint: when `aim` first transitions to non-null, check
  // AsyncStorage. If the hint hasn't been shown on this device, mark
  // it shown and surface the toast for 3s.
  useEffect(() => {
    if (!aim) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    AsyncStorage.getItem('oga.aim-hint-shown')
      .then((v) => {
        if (cancelled || v) return
        AsyncStorage.setItem('oga.aim-hint-shown', '1').catch(() => {})
        setAimHintVisible(true)
        timer = setTimeout(() => setAimHintVisible(false), 3000)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [aim?.lat, aim?.lng])

  // Auto-spawn the aim target when the player enters SET_AIM. With a ball
  // and a pin but no aim yet, seed one on the straight ball→pin line at
  // AIM_AUTOSPAWN_FRACTION so the aim line, crosshair, and carry/remaining
  // readouts appear immediately — no long-press needed to start (refs
  // ux-09). Guarded on `!aim` so a dragged or long-pressed aim is never
  // overwritten; markBallHere resets aim to null for the next shot, so this
  // re-fires per shot. No-pin holes fall back to long-press-to-start.
  const effectivePin = roundPin ?? storedPin ?? null
  useEffect(() => {
    // Suppressed while revisiting a played hole — no live aim aid until the
    // player opts into adding a shot (#484).
    if (isRevisitingPlayedHole) return
    if (roundState !== 'SET_AIM') return
    if (aim || !ball || !effectivePin) return
    setAim({
      lat: ball.lat + AIM_AUTOSPAWN_FRACTION * (effectivePin.lat - ball.lat),
      lng: ball.lng + AIM_AUTOSPAWN_FRACTION * (effectivePin.lng - ball.lng),
    })
  }, [
    isRevisitingPlayedHole,
    roundState,
    aim,
    ball?.lat,
    ball?.lng,
    effectivePin?.lat,
    effectivePin?.lng,
  ])

  // An untouched aim is the auto-spawn suggestion. Reset the touched flag
  // whenever the aim clears (new shot, hole change, re-place ball — all the
  // setAim(null) paths) so the next auto-spawn starts untouched; a real
  // drag/long-press re-sets it via LiveRoundSession's onSetAim wrapper.
  useEffect(() => {
    if (!aim) setAimTouched(false)
  }, [aim])

  // Reset the just-saved-shot ref synchronously on hole transition. Keeping
  // it inside the async count-load effect created a race: a tap-to-mark-ball
  // that set the ref could be wiped out when the (slower) count load
  // resolved a moment later, leaving shot N's end_lat/end_lng unset.
  useEffect(() => {
    lastSavedShotLocalIdRef.current = null
  }, [currentHoleScoreId])

  // Live GPS during the PLACE_BALL phase so the ball marker tracks the
  // player as they walk between shots. Raw phone GPS is ±3-10 m which
  // can corrupt SG by 6-20 yd at golf scale, so the readings are run
  // through a Kalman filter (issue #123) before driving the ball.
  useEffect(() => {
    if (!currentHoleId) return
    if (isPastMode) return
    // Suppressed while revisiting a played hole — no GPS ball watcher/marker
    // until the player opts into adding a shot (#484).
    if (isRevisitingPlayedHole) return
    if (roundState !== 'PLACE_BALL') return
    let active = true
    let subscription: Location.LocationSubscription | null = null
    ;(async () => {
      try {
        // expo-location's permission request can hang on Android if the
        // activity is recreated mid-dialog (rotation, theme change, OEM
        // low-memory recycle). LocationHelpers.kt uses suspendCoroutine
        // with no cancellation hook and no host-lifecycle cleanup, so
        // the JS promise never settles. Race against a 10s timeout —
        // matches PROFILE_FETCH_TIMEOUT_MS pattern in (app)/_layout.tsx.
        // On timeout we treat as not-granted; user falls back to manual
        // tap-to-place. See #278.
        const perm = await Promise.race([
          Location.requestForegroundPermissionsAsync(),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('perm-timeout')), 10_000),
          ),
        ]).catch((e: Error) => {
          // eslint-disable-next-line no-console
          console.warn('[useHoleState perm-timeout]', e.message)
          return { status: 'undetermined' as const }
        })
        if (perm.status !== 'granted') return
        if (!active) return
        // Last known fix first — instant, no satellite wait. Returns null
        // if the device has nothing cached (cold boot, location services
        // recently toggled). Seeds gpsPosition immediately so the recenter
        // button and "Mark ball" CTA aren't greyed on hole load.
        try {
          const last = await Location.getLastKnownPositionAsync()
          if (active && last) {
            setGpsPosition({
              lat: last.coords.latitude,
              lng: last.coords.longitude,
            })
          }
        } catch {
          // ignore
        }
        if (!active) return
        // Fire-and-forget fresh fix. AWAITING this on Android hangs the
        // entire effect indefinitely under poor signal — the promise
        // never resolves, try/catch doesn't save us, and
        // watchPositionAsync below never gets installed. Mapbox's
        // LocationPuck has its own native subscription that bypasses
        // expo-location, which is why the puck appeared while
        // gpsPosition stayed null.
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then((initial) => {
            if (active) {
              setGpsPosition({
                lat: initial.coords.latitude,
                lng: initial.coords.longitude,
              })
            }
          })
          .catch(() => {
            // No fresh fix — watchPositionAsync still has a chance.
          })
        subscription = await Location.watchPositionAsync(
          {
            // Balanced (~100 m) returns fixes immediately on Android.
            // High required FUSED HIGH_ACCURACY which can sit waiting
            // for a precise lock under degraded signal — UX-wise we
            // only need accurate-enough to (a) light up the recenter
            // button and (b) gate the 80-yd nearPin radius. Ball
            // placement runs the readings through Kalman downstream,
            // so accuracy here doesn't directly drive SG precision.
            accuracy: Location.Accuracy.Balanced,
            // 5 m chosen over 2 m for battery — at a ~1.4 m/s walking pace
            // that's still a fix every ~3.5 s while moving, and Kalman
            // smooths the gap. The marker is tap/drag-confirmed before
            // shot capture, so coarser auto-tracking is fine.
            distanceInterval: 5,
            // Heartbeat tick so gpsPosition refreshes even at rest. Pure
            // distanceInterval gating meant the recenter button could
            // never update once the player stopped walking. 5 s is plenty
            // for that UX (the recenter button doesn't need sub-second
            // refresh at rest) and keeps the GPS chip from being held
            // warm by a 2 s polling cadence.
            timeInterval: 5000,
          },
          (loc) => {
            if (!active) return
            const rawPoint = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
              timestamp: loc.timestamp,
            }
            // Defense-in-depth NaN guard (#275). Kalman's update path
            // already drops corrupt readings safely, but gpsPosition
            // bypasses the filter and flows directly to setPendingShotEnd
            // via markBallHere — a NaN there hits Postgres as a double
            // precision insert error and wedges the round.
            if (!Number.isFinite(rawPoint.lat) || !Number.isFinite(rawPoint.lng)) {
              return
            }
            // Always update gpsPosition (puck-adjacent recenter target +
            // nearPin radius check) regardless of manual ball placement.
            // The freeze below is solely about preventing GPS from
            // clobbering the BALL marker after the player has dragged or
            // tapped it. Using raw OS coords here, not Kalman-smoothed,
            // because the manual-place handler re-anchors Kalman with a
            // strong prior — using the smoothed value would lie for
            // many readings after manual placement.
            setGpsPosition({ lat: rawPoint.lat, lng: rawPoint.lng })
            // Manual placement freezes GPS-driven ball updates. Without
            // this, the next reading after a drag would re-init the
            // filter at the raw GPS point and snap ball back, wiping
            // the player's refinement.
            if (manuallyPlacedRef.current) return
            kalmanStateRef.current = kalmanStateRef.current
              ? updateKalman(kalmanStateRef.current, rawPoint)
              : createKalmanState(rawPoint)
            const smoothed = {
              lat: kalmanStateRef.current.lat,
              lng: kalmanStateRef.current.lng,
            }
            setBall(smoothed)
          },
        )
        // Cleanup may have run while watchPositionAsync was in flight —
        // the `if (!active)` guard above only covers the window before
        // this await, not after it. Remove immediately if stale.
        if (!active) {
          subscription.remove()
          return
        }
        gpsSubscriptionRef.current = subscription
      } catch {
        // GPS not available — user will tap to place.
      }
    })()
    return () => {
      active = false
      subscription?.remove()
      gpsSubscriptionRef.current = null
      // Phase exit clears the filter so re-entry to PLACE_BALL on the
      // next shot starts smoothing from a fresh fix rather than an
      // old anchor that may now be hundreds of yards away. Also clears
      // the manual-placement freeze so the next PLACE_BALL cycle
      // resumes GPS auto-tracking unless the player drags again.
      kalmanStateRef.current = null
      manuallyPlacedRef.current = false
    }
  }, [currentHoleId, isPastMode, isRevisitingPlayedHole, roundState, gpsNonce])

  // Hole change resets per-hole state. The screen is resident (#264) so
  // nothing remounts on a hole switch — without an explicit reset the
  // previous hole's ball/aim render frozen on the new hole and the state
  // machine stays mid-shot. Also clears the Kalman filter + manual-place
  // freeze (the watch effect's cleanup covers those too, but this is
  // explicit for the cases where the watch effect short-circuits — past
  // mode, or no current hole — before subscribing).
  useEffect(() => {
    // Guard on a real id so a transient null mid-session (e.g. a
    // background refetch briefly emptying the holes list) can't wipe an
    // in-progress ball/aim. A genuine hole switch goes id→id (both
    // non-null), so this never blocks the intended reset.
    if (!currentHoleId) return
    kalmanStateRef.current = null
    manuallyPlacedRef.current = false
    setBall(null)
    setAim(null)
    setRoundState('PLACE_BALL')
    // Each hole entry starts un-engaged: a played hole opens in the
    // breadcrumb-only review posture until the player taps "Add a shot". A
    // fresh hole has no prior shots, so isRevisitingPlayedHole is false anyway.
    setAppendEngaged(false)
  }, [currentHoleId])

  // Default shot 1's ball marker to the tee box so the player starts from a
  // sensible point instead of an empty map. This is only an INITIAL default:
  // live GPS (PLACE_BALL effect above) and manual drag both overwrite it, and
  // the `!ball` guard means it never clobbers a ball GPS/the player already
  // placed. Gated to shot 1 (no prior shots), PLACE_BALL, live mode, and a
  // known tee. Past mode places shots by hand, so it's excluded.
  useEffect(() => {
    if (isPastMode) return
    if (hasPriorShots) return
    if (roundState !== 'PLACE_BALL') return
    if (ball || !tee) return
    setBall({ lat: tee.lat, lng: tee.lng })
  }, [isPastMode, hasPriorShots, roundState, ball, tee?.lat, tee?.lng])

  // Stop GPS when the app backgrounds. The native location callback
  // fires into a null JS module if the OS tears down the app while a
  // subscription is live, causing a fatal NPE in expo-location.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        gpsSubscriptionRef.current?.remove()
        gpsSubscriptionRef.current = null
      } else if (state === 'active') {
        setGpsNonce((n) => n + 1)
      }
    })
    return () => sub.remove()
  }, [])

  // Highlight "On the green" once the player is within 80 yd of the stored
  // pin AND a per-round pin hasn't been captured yet.
  const nearPin = useMemo(() => {
    if (roundPin) return false
    if (!storedPin || !gpsPosition) return false
    return distanceYards(gpsPosition, storedPin) <= PIN_PROMPT_RADIUS_YARDS
  }, [roundPin, storedPin, gpsPosition])

  return {
    aim,
    setAim,
    aimTouched,
    setAimTouched,
    ball,
    setBall,
    roundState,
    setRoundState,
    gpsPosition,
    kalmanStateRef,
    manuallyPlacedRef,
    lastSavedShotLocalIdRef,
    aimHintVisible,
    setAimHintVisible,
    nearPin,
    isRevisitingPlayedHole,
    setAppendEngaged,
  }
}
