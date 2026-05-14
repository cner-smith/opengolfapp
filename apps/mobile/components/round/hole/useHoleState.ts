import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import { AppState } from 'react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createKalmanState, updateKalman, type KalmanState } from '@oga/core'
import type { LatLng } from '../HoleMap'
import { distanceYards } from '../../../lib/maps'
import { PIN_PROMPT_RADIUS_YARDS, type RoundState } from './types'

interface UseHoleStateInput {
  currentHoleId: string | null | undefined
  currentHoleScoreId: string | null | undefined
  isPastMode: boolean
  storedPin: LatLng | null
  roundPin: LatLng | null
}

export interface UseHoleStateResult {
  aim: LatLng | null
  setAim: Dispatch<SetStateAction<LatLng | null>>
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
}

export function useHoleState({
  currentHoleId,
  currentHoleScoreId,
  isPastMode,
  storedPin,
  roundPin,
}: UseHoleStateInput): UseHoleStateResult {
  const [aim, setAim] = useState<LatLng | null>(null)
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
  }, [currentHoleId, isPastMode, roundState, gpsNonce])

  // Hole change resets the filter — covered by the watch effect's
  // cleanup, but explicit here in case the watch effect short-circuits
  // (past mode, or no current hole) before subscribing.
  useEffect(() => {
    kalmanStateRef.current = null
    manuallyPlacedRef.current = false
  }, [currentHoleId])

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
  }
}
