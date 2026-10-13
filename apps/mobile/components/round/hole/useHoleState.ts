import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import { AppState, PermissionsAndroid, Platform } from 'react-native'
import * as Location from 'expo-location'
import { locationManager } from '@rnmapbox/maps'
import { initialLiveBall, liveBall, markSpot, type BallSource, type LiveBallEvent } from '@oga/core'
import type { LatLng } from '../HoleMap'
import { distanceYards } from '../../../lib/maps'
import { PIN_PROMPT_RADIUS_YARDS, type RoundState } from './types'
import { useAuth } from '../../../hooks/useAuth'
import { markSeenFlags, seenFlags } from '../../../lib/seenFlags'
import { logDiag } from '../../../lib/db'

const AIM_HINT_KEY = 'oga.aim-hint-shown'

// Fraction of the straight ball→pin line where the aim auto-spawns when
// the player enters SET_AIM without having dropped one yet. ~0.65 puts the
// target two-thirds up the hole — a sensible default aim the player then
// drags to refine (refs ux-09). A long-press still repositions it freely.
// Capped at the auto-picked club's typical distance when that is known at spawn time,
// so it doesn't ask for a shot the club can't hit (#1006).
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
  /** Median distance of the wheel's auto-picked club; null until one is known.
   *  A ref because the pick is derived from this hook's own `ball`. */
  autoClubYardsRef: MutableRefObject<number | null>
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
  /** Where the ball came from: GPS, placed by hand, or the replay spot after an OB. */
  ballSource: BallSource
  /** Every ball change goes through @oga/core's liveBall rule (#1107). */
  dispatchBall: Dispatch<LiveBallEvent>
  /** Where "Mark my ball" puts the start: a held spot, else the latest fix. */
  markSpot: LatLng | null
  /** A shot was saved and no GPS fix has arrived since (#1108). */
  awaitingFix: boolean
  roundState: RoundState
  setRoundState: Dispatch<SetStateAction<RoundState>>
  gpsPosition: LatLng | null
  /** Epoch ms of the newest fix behind gpsPosition (the fix's own
   *  timestamp — stale cache replays report their true age). 0 = none. */
  gpsFixAtRef: MutableRefObject<number>
  ballDraggingRef: MutableRefObject<boolean>
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
  autoClubYardsRef,
}: UseHoleStateInput): UseHoleStateResult {
  const [aim, setAim] = useState<LatLng | null>(null)
  // Auto-spawned aims start untouched; flipped true by a user drag/long-press
  // (LiveRoundSession wraps onSetAim). Reset whenever the aim clears (effect
  // below) so each new shot's suggestion starts untouched.
  const [aimTouched, setAimTouched] = useState(false)
  // The ball, its source and its GPS smoothing: one rule in @oga/core (#1107).
  const [ballState, dispatchBall] = useReducer(liveBall, initialLiveBall)
  const { ball, source: ballSource } = ballState
  // For the GPS listener's diagnostic log, which closes over its first render.
  const ballSourceRef = useRef(ballSource)
  ballSourceRef.current = ballSource
  // Ref so the AppState listener can remove the subscription if the app
  // backgrounds while GPS is active — prevents the native callback from
  // firing into a null JS module object after the OS tears down the app.
  const gpsSubscriptionRef = useRef<{ remove: () => void } | null>(null)
  // True while the ball marker is under the finger (#659).
  const ballDraggingRef = useRef(false)
  // local_id of the just-saved pending shot, so the next PLACE_BALL
  // can fill in that shot's end_lat/end_lng with the new ball position.
  const lastSavedShotLocalIdRef = useRef<number | null>(null)
  // False until the hole-reset effect has run for a real hole once. Lets that
  // effect tell the component's first mount (round resume → auto-engage) from
  // later in-session hole switches (review posture). See #640.
  const hasMountedHoleRef = useRef(false)
  const [roundState, setRoundState] = useState<RoundState>('PLACE_BALL')
  const [gpsPosition, setGpsPosition] = useState<LatLng | null>(null)
  // Epoch ms of the fix behind gpsPosition — the fix's OWN timestamp, so
  // cache replays and last-known seeds report their true age. 0 until any
  // fix arrives. Lets markBallHere decline a stale fallback fix (#720).
  const gpsFixAtRef = useRef(0)
  const [gpsNonce, setGpsNonce] = useState(0)
  // First-use hint that "aim point = start line, drag to adjust." Gated
  // by a per-account flag (lib/seenFlags) so it only appears the first time
  // the player ever sets an aim point, then auto-dismisses after 3s.
  const [aimHintVisible, setAimHintVisible] = useState(false)
  const userId = useAuth().user?.id
  // Set true once the player engages the live append flow on this hole visit —
  // via "Add a shot" or by marking a ball. Reset on hole change. Anchoring to an
  // in-visit action (not an entry-time shot-count snapshot) sidesteps the async
  // shot-count load: hasPriorShots can arrive a beat late without flipping it.
  const [appendEngaged, setAppendEngaged] = useState(false)
  const isRevisitingPlayedHole = hasPriorShots && !appendEngaged

  // First-aim hint: when `aim` first transitions to non-null, check the
  // flag. If the hint hasn't been shown to this account, mark
  // it shown and surface the toast for 3s.
  useEffect(() => {
    if (!aim || !userId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    void seenFlags(userId, [AIM_HINT_KEY]).then(([seen]) => {
      if (cancelled || seen) return
      void markSeenFlags(userId, [AIM_HINT_KEY])
      setAimHintVisible(true)
      timer = setTimeout(() => setAimHintVisible(false), 3000)
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [aim?.lat, aim?.lng, userId])

  // Auto-spawn the aim target when the player enters SET_AIM. With a ball
  // and a pin but no aim yet, seed one on the straight ball→pin line at
  // AIM_AUTOSPAWN_FRACTION so the aim line, crosshair, and aim/remaining
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
    const clubYards = autoClubYardsRef.current
    const toPin = distanceYards(ball, effectivePin)
    const f = clubYards && toPin > 0 ? Math.min(AIM_AUTOSPAWN_FRACTION, clubYards / toPin) : AIM_AUTOSPAWN_FRACTION
    setAim({
      lat: ball.lat + f * (effectivePin.lat - ball.lat),
      lng: ball.lng + f * (effectivePin.lng - ball.lng),
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
  // player as they walk between shots. The ball is the raw fix, so it shows
  // exactly where Mark saves (#1108); the player confirms it before the shot.
  useEffect(() => {
    if (!currentHoleId) return
    if (isPastMode) return
    // NOTE: the subscription runs even while revisiting a played hole so
    // gpsPosition keeps updating — that drives the recenter button + "Mark
    // ball" CTA, which were grey-locked when the whole effect was gated
    // here (regression #640). The #484 review posture (no auto-place / no
    // auto-aim) is enforced downstream at the ball gate, not by skipping
    // the whole watcher.
    if (roundState !== 'PLACE_BALL') return
    let active = true
    let subscription: { remove: () => void } | null = null
    ;(async () => {
      try {
        // Permission gate. On Android this must NOT go through
        // expo-location: its permission request hangs on real devices the
        // same way its position APIs do (#704 class; on-device logcat
        // 2026-07-09, S23 prod build, showed the 10 s timeout firing on
        // every run — the Mapbox chain below never started, #729). RN
        // core's PermissionsAndroid is its own native module: `check` is
        // instant when permission is already granted, `request` drives the
        // system dialog without expo-location's suspendCoroutine hang
        // (#278). iOS keeps expo-location, which works there. The 10 s
        // race stays as defense on both; timeout = not granted, user
        // falls back to manual tap-to-place.
        const granted = await Promise.race([
          (async () => {
            if (Platform.OS === 'android') {
              const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
              if (await PermissionsAndroid.check(fine)) return true
              const res = await PermissionsAndroid.request(fine)
              return res === PermissionsAndroid.RESULTS.GRANTED
            }
            const perm = await Location.requestForegroundPermissionsAsync()
            return perm.status === 'granted'
          })(),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('perm-timeout')), 10_000),
          ),
        ]).catch((e: Error) => {
          // eslint-disable-next-line no-console -- release-visible diagnostic; how #729 was confirmed on-device
          console.warn('[useHoleState perm-timeout]', e.message)
          return false
        })
        if (!granted) return
        if (!active) return
        // GPS source is Mapbox's location engine, NOT expo-location. All
        // three expo-location read paths (getLastKnownPositionAsync,
        // getCurrentPositionAsync, watchPositionAsync) silently deliver
        // nothing on Android under SDK 53 / expo-location 18.1.6 — the
        // native fused request never starts (expo/expo#39851; field-
        // confirmed 2026-07-08, #704). locationManager is a Mapbox-native
        // provider like the LocationPuck's (the puck renders via the native
        // RNMBXNativeUserLocation view — a separate subscription, not this
        // one); both bypass expo-location's broken fused-provider path, so
        // this works wherever the blue dot does.
        // expo-location stays for the permission prompt above only.
        // Re-test expo-location at the SDK 54 / expo-location 19 bump
        // (#704 checklist) before considering a switch back.
        try {
          // Last known fix first — instant, no satellite wait. Seeds
          // gpsPosition so the recenter button and "Mark ball" CTA aren't
          // greyed on hole load.
          const last = await locationManager.getLastKnownLocation()
          if (
            active &&
            last &&
            // Same defense-in-depth NaN guard as the listener path below
            // (#275) — this seed flows to the recenter camera and nearPin
            // un-gated, and (via gpsPosition) to markBallHere's fallback.
            Number.isFinite(last.coords.latitude) &&
            Number.isFinite(last.coords.longitude)
          ) {
            // Record the fix's OWN timestamp (not now) so markBallHere can
            // decline a stale cached fix; absent timestamp = treat as stale.
            gpsFixAtRef.current = last.timestamp ?? 0
            setGpsPosition({
              lat: last.coords.latitude,
              lng: last.coords.longitude,
            })
          }
        } catch {
          // ignore — the listener below delivers within ~a second
        }
        if (!active) return
        const onLocation = (loc: {
          coords: { latitude: number; longitude: number; accuracy?: number }
          timestamp?: number
        }) => {
          if (!active) return
          const rawPoint = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
            timestamp: loc.timestamp ?? Date.now(),
          }
          // Defense-in-depth NaN guard (#275): a fix flows to
          // setPendingShotEnd via markBallHere — a NaN there hits Postgres
          // as a double precision insert error and wedges the round.
          if (!Number.isFinite(rawPoint.lat) || !Number.isFinite(rawPoint.lng)) {
            return logDiag('gps_fix', { use: 'malformed' })
          }
          // Always update gpsPosition (puck-adjacent recenter target +
          // nearPin radius check), raw, whatever the ball is doing: the ball
          // itself goes through the liveBall rule below.
          // Functional update with an identity bailout: returning `prev` on
          // identical coords (duplicate ticks, the addListener cache replay)
          // skips the re-render entirely.
          // Record the fix's own timestamp so markBallHere can tell a live
          // tick from a stale cache replay when gpsPosition is its only
          // source (#720).
          gpsFixAtRef.current = rawPoint.timestamp
          setGpsPosition((prev) =>
            prev && prev.lat === rawPoint.lat && prev.lng === rawPoint.lng
              ? prev
              : { lat: rawPoint.lat, lng: rawPoint.lng },
          )
          // addListener synchronously replays the manager's cached last
          // point into a new listener (library behavior). That cache can
          // predate this PLACE_BALL cycle — previous hole, pocketed phone —
          // so stale fixes stop here: gpsPosition only (matching the old
          // last-known → gpsPosition-only semantics), never the ball path
          // below, where a stale anchor would visibly snap the marker. 10 s is
          // generous against the ~3.5 s walking-pace tick cadence.
          const fix = {
            accuracyM: rawPoint.accuracy != null ? Math.round(rawPoint.accuracy) : null,
            ageMs: Date.now() - rawPoint.timestamp,
          }
          if (fix.ageMs > 10_000) return logDiag('gps_fix', { ...fix, use: 'stale' })
          // Review posture (#484): on a hole the player navigated BACK to,
          // keep the GPS chip/recenter live (setGpsPosition above) but don't
          // auto-drive the BALL marker — the hole shows only its existing
          // shot breadcrumb until they opt into adding a shot.
          if (isRevisitingPlayedHole) return logDiag('gps_fix', { ...fix, use: 'revisit' })
          // Under the finger the ball stays put; otherwise the liveBall rule
          // decides (a ball placed by hand or on the OB replay spot holds).
          if (ballDraggingRef.current) return logDiag('gps_fix', { ...fix, use: 'dragging' })
          logDiag('gps_fix', { ...fix, use: ballSourceRef.current === 'gps' ? 'ball' : `held_${ballSourceRef.current}` })
          dispatchBall({ type: 'fix', lat: rawPoint.lat, lng: rawPoint.lng, accuracy: rawPoint.accuracy })
        }
        // 1 m distance filter (#1108; was 5 m): a 2–4 m walk between putts
        // must register. Without it the engine starts unfiltered (start(-1))
        // and ticks ~1 Hz. The manager persists the value across its
        // internal stop/start, so once is enough. At rest there are no
        // ticks; after a save that leaves the ball awaiting a fix, and Mark
        // asks for one rather than reusing the old spot.
        // The awaits above (permission race, last-known IPC) leave a window
        // where the app can background: the AppState handler finds
        // gpsSubscriptionRef null (no-op), so this continuation would attach
        // anyway — addListener unconditionally start()s the engine, leaving
        // GPS running for the whole backgrounded stretch (#720). Bail; the
        // foreground gpsNonce bump re-runs the effect.
        if (!active || AppState.currentState !== 'active') return
        locationManager.setMinDisplacement(1)
        // addListener auto-starts the engine; removeListener auto-stops it
        // when the last listener detaches (both synchronous — no in-flight
        // await race to guard here).
        locationManager.addListener(onLocation)
        logDiag('gps_listen', { hole: currentHoleId })
        subscription = {
          remove: () => locationManager.removeListener(onLocation),
        }
        gpsSubscriptionRef.current = subscription
      } catch (e) {
        // eslint-disable-next-line no-console -- deliberately loud: GPS-source failures were previously silent and cost a field session to find (#704)
        console.warn('[useHoleState gps-source]', (e as Error)?.message)
        // GPS not available — user will tap to place.
      }
    })()
    return () => {
      active = false
      subscription?.remove()
      gpsSubscriptionRef.current = null
      // Teardown ONLY — never reset the ball here. This cleanup also fires
      // on gpsNonce (every foreground return) and isRevisitingPlayedHole
      // re-runs, where a manual ball placement must survive (#713). A saved
      // shot or a new hole hands the ball back to GPS (liveBall).
    }
  }, [currentHoleId, isPastMode, isRevisitingPlayedHole, roundState, gpsNonce])

  // A drag can't outlive the place-ball step it started in.
  useEffect(() => {
    if (roundState !== 'PLACE_BALL') ballDraggingRef.current = false
  }, [roundState])

  // Hole change resets per-hole state. The screen is resident (#264) so
  // nothing remounts on a hole switch — without an explicit reset the
  // previous hole's ball/aim render frozen on the new hole and the state
  // machine stays mid-shot. The ball starts clean (liveBall holeChanged).
  useEffect(() => {
    // Guard on a real id so a transient null mid-session (e.g. a
    // background refetch briefly emptying the holes list) can't wipe an
    // in-progress ball/aim. A genuine hole switch goes id→id (both
    // non-null), so this never blocks the intended reset.
    if (!currentHoleId) return
    ballDraggingRef.current = false
    dispatchBall({ type: 'holeChanged' })
    setAim(null)
    setRoundState('PLACE_BALL')
    // The FIRST hole this component mounts with is the round's resume point
    // (relaunch / navigate Home and back) — the player is actively on it, so
    // engage it and let GPS auto-place resume without a "+ Add a shot" tap
    // (regression #640). Only genuine in-session hole SWITCHES drop into the
    // #484 breadcrumb-only review posture. A fresh hole has no prior shots, so
    // isRevisitingPlayedHole is false regardless of this flag.
    setAppendEngaged(!hasMountedHoleRef.current)
    hasMountedHoleRef.current = true
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
    dispatchBall({ type: 'teeDefault', tee: { lat: tee.lat, lng: tee.lng } })
  }, [isPastMode, hasPriorShots, roundState, ball, tee?.lat, tee?.lng])

  // Stop GPS when the app backgrounds. A native location callback firing
  // into a torn-down JS runtime is a fatal-NPE class of bug (bitten once
  // via expo-location), and the app is foreground-only for location anyway.
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
    ballSource,
    dispatchBall,
    markSpot: markSpot(ballState),
    awaitingFix: ballState.awaitingFix,
    roundState,
    setRoundState,
    gpsPosition,
    gpsFixAtRef,
    ballDraggingRef,
    lastSavedShotLocalIdRef,
    aimHintVisible,
    setAimHintVisible,
    nearPin,
    isRevisitingPlayedHole,
    setAppendEngaged,
  }
}
