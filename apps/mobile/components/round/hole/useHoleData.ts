import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { inferHoleCount, isPuttShot } from '@oga/core'
import type { Database } from '@oga/supabase'
import {
  pendingShotsForHoleScore,
  type PendingShot,
  type ShotPayload,
} from '../../../lib/db'
import { supabase } from '../../../lib/supabase'
import type { LatLng } from '../HoleMap'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']

export interface UseHoleDataResult {
  round: RoundRow | null
  setRound: React.Dispatch<React.SetStateAction<RoundRow | null>>
  holes: HoleRow[]
  setHoles: React.Dispatch<React.SetStateAction<HoleRow[]>>
  holeScores: HoleScoreRow[]
  setHoleScores: React.Dispatch<React.SetStateAction<HoleScoreRow[]>>
  loading: boolean
  error: string | null
  loadAll: () => Promise<void>
  holeCount: 9 | 18
  effectiveHoles: HoleRow[]
  currentHole: HoleRow | null
  currentHoleScore: HoleScoreRow | null
  storedPin: LatLng | null
  roundPin: LatLng | null
  tee: LatLng | null
  courseCenter: LatLng | null
  remoteShotCount: number
  remotePuttCount: number
  remoteShotStarts: LatLng[]
  pendingForHole: PendingShot[]
  setPendingForHole: React.Dispatch<React.SetStateAction<PendingShot[]>>
  previousShots: LatLng[]
  previousShotIds: string[]
  refreshShots: () => void
  localShotCount: number
  localPuttCount: number
  shotNumber: number
}

export function useHoleData(
  id: string | undefined,
  holeNumber: number,
): UseHoleDataResult {
  const [round, setRound] = useState<RoundRow | null>(null)
  const [courseCenter, setCourseCenter] = useState<LatLng | null>(null)
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [remoteShotCount, setRemoteShotCount] = useState(0)
  const [remotePuttCount, setRemotePuttCount] = useState(0)
  const [pendingForHole, setPendingForHole] = useState<PendingShot[]>([])
  const [remoteShotStarts, setRemoteShotStarts] = useState<LatLng[]>([])
  const [remoteShotIds, setRemoteShotIds] = useState<string[]>([])
  const [shotsRefreshNonce, setShotsRefreshNonce] = useState(0)
  const refreshShots = useCallback(() => setShotsRefreshNonce((n) => n + 1), [])

  // How many holes this round plays. course_tees.par is unpopulated in
  // our crawled data, so infer from the mapped hole numbers — a genuine
  // 9-hole course stays 9 instead of padding to 18 phantom holes (#525).
  const holeCount = useMemo(
    () => inferHoleCount(holes.map((h) => h.number)),
    [holes],
  )

  // Synthetic-holes fallback. Mirrors the web pattern documented in
  // CLAUDE.md: when the course has fewer real `holes` rows than the
  // expected count, pad with par-4 placeholders keyed
  // `synthetic-${roundId}-hole-${n}` so the UI can render and the player
  // isn't trapped on a "Hole not found" screen.
  const effectiveHoles = useMemo<HoleRow[]>(() => {
    if (!round) return holes
    if (holes.length >= holeCount) return holes
    const realByNumber = new Map<number, HoleRow>()
    for (const h of holes) realByNumber.set(h.number, h)
    return Array.from({ length: holeCount }, (_, i) => {
      const num = i + 1
      const real = realByNumber.get(num)
      if (real) return real
      return {
        id: `synthetic-${round.id}-hole-${num}`,
        course_id: round.course_id,
        number: num,
        par: 4,
        yards: null,
        stroke_index: num,
        tee_lat: null,
        tee_lng: null,
        pin_lat: null,
        pin_lng: null,
      } as HoleRow
    })
  }, [holes, round, holeCount])

  const currentHole = useMemo(
    () => effectiveHoles.find((h) => h.number === holeNumber) ?? null,
    [effectiveHoles, holeNumber],
  )
  const currentHoleScore = useMemo(
    () => holeScores.find((hs) => hs.hole_id === currentHole?.id) ?? null,
    [holeScores, currentHole?.id],
  )

  const storedPin: LatLng | null =
    currentHole?.pin_lat != null && currentHole.pin_lng != null
      ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
      : null
  const roundPin: LatLng | null =
    currentHoleScore?.pin_lat != null && currentHoleScore.pin_lng != null
      ? { lat: currentHoleScore.pin_lat, lng: currentHoleScore.pin_lng }
      : null
  // The course's stored tee (OSM-mapped or synthetic). Used as the pre-shot
  // fallback; once the player has hit, the live tee is their first shot's
  // start (see `tee` below) — most courses now carry an OSM tee, and pinning
  // the marker there instead of where the player actually teed off is wrong
  // for the live round.
  const storedTee: LatLng | null =
    currentHole?.tee_lat != null && currentHole.tee_lng != null
      ? { lat: currentHole.tee_lat, lng: currentHole.tee_lng }
      : null

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      // If the round was deleted (e.g. from the home list) while this live
      // session is still mounted, a 0-row result returns null instead of
      // throwing PGRST116 "cannot coerce to a single JSON object" — surfaced
      // cleanly as "Round not found" below.
      const { data: r, error: rErr } = await supabase
        .from('rounds')
        .select('*, courses(lat, lng)')
        .eq('id', id)
        .maybeSingle()
      if (rErr || !r) throw rErr ?? new Error('Round not found')
      setRound(r)
      setCourseCenter(
        r.courses && r.courses.lat != null && r.courses.lng != null
          ? { lat: r.courses.lat, lng: r.courses.lng }
          : null,
      )

      const [hRes, hsRes] = await Promise.all([
        supabase.from('holes').select('*').eq('course_id', r.course_id).order('number'),
        supabase.from('hole_scores').select('*').eq('round_id', r.id),
      ])
      if (hRes.error) throw hRes.error
      if (hsRes.error) throw hsRes.error
      setHoles(hRes.data ?? [])
      setHoleScores(hsRes.data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Reload remote + local shot/putt counts whenever the active hole_score
  // changes. Putts are counted as shots where club='putter' OR lie_type='green'.
  // Also pulls remote shot start coords so the on-map waypoint breadcrumb
  // survives a screen reload mid-hole.
  //
  // The original `let active = true` cleanup pattern protects against deps
  // changing mid-fetch, but doesn't protect against two effect runs sharing
  // the same `currentHoleScore.id` value (e.g. parent re-render that
  // schedules a re-run without a value change, or a quick navigate-away-
  // and-back). A monotonic nonce ref makes this race-free: every effect
  // run claims a unique nonce; only the run whose nonce still matches the
  // ref's latest value is allowed to commit setState. Stale fetches that
  // resolve after a newer run started are silently dropped. (#284)
  const fetchNonceRef = useRef(0)
  useEffect(() => {
    // Reset to the neutral "unknown" state synchronously, before the async
    // fetch below resolves. Without this, a hole switch during the fetch
    // RTT leaves the PREVIOUS hole's counts in state — e.g. `hasPriorShots`
    // (LiveRoundSession) reads a stale true/false and the tee-default effect
    // can place a ball marker on a hole the player is only reviewing (#720
    // item 2). 0/[] also matches the true pre-fetch state of a fresh hole,
    // so this isn't a behavior change for the common case.
    setRemoteShotCount(0)
    setRemotePuttCount(0)
    setRemoteShotStarts([])
    setRemoteShotIds([])
    setPendingForHole([])
    if (!currentHoleScore) return
    const myNonce = ++fetchNonceRef.current
    ;(async () => {
      try {
        const fetchShots = () =>
          supabase
            .from('shots')
            .select('id, club, lie_type, shot_number, start_lat, start_lng')
            .eq('hole_score_id', currentHoleScore.id)
            .order('shot_number')
        const [shotsResInitial, localInitial] = await Promise.all([
          fetchShots(),
          // The SQLite read gets the same one-retry treatment as the remote
          // fetch below — a transient rejection must not leave the neutral
          // reset committed as a confident local=0 the save path could
          // collide on (same class as the remote arm of #712).
          pendingShotsForHoleScore(currentHoleScore.id).catch(() => null),
        ])
        if (myNonce !== fetchNonceRef.current) return
        let local = localInitial
        if (local === null) {
          local = await pendingShotsForHoleScore(currentHoleScore.id).catch(
            () => null,
          )
          if (myNonce !== fetchNonceRef.current) return
          if (local === null) {
            if (__DEV__) {
              console.warn('[hole/pending-fetch] SQLite read failed twice')
            }
            return
          }
        }
        let shotsRes = shotsResInitial
        if (shotsRes.error) {
          // postgrest-js returns failures in-band ({data: null, error}) —
          // the promise resolves normally, so this can't be caught by the
          // outer try/catch. One retry covers most transient failures
          // (mirrors the sync.ts chunk-upsert retry); if it fails twice,
          // leave counts at the neutral reset above rather than committing
          // a confident remote=0 that the save path could collide on.
          shotsRes = await fetchShots()
          if (myNonce !== fetchNonceRef.current) return
          if (shotsRes.error) {
            if (__DEV__) {
              console.warn(
                '[hole/shots-fetch]',
                shotsRes.error.message,
              )
            }
            return
          }
        }
        const shots = shotsRes.data ?? []
        // Dedupe the sync-in-flight window: a shot whose server row just
        // committed can still be 'pending' locally for a beat before
        // markShotSynced runs (lib/sync.ts marks rows synced one at a time
        // after the chunk upsert). Both payload.id (client-generated, set
        // before every insert) and the remote row's id are compared so a
        // mid-sync shot counts once, not twice (#714).
        const remoteIds = new Set(shots.map((s) => s.id))
        const dedupedLocal = local.filter((p) => {
          try {
            const payload = JSON.parse(p.payload) as ShotPayload
            return !payload.id || !remoteIds.has(payload.id)
          } catch {
            return true
          }
        })
        setRemoteShotCount(shots.length)
        setRemotePuttCount(shots.filter((s) => isPuttShot(s.lie_type)).length)
        const starts: LatLng[] = []
        const ids: string[] = []
        for (const r of shots) {
          if (r.start_lat != null && r.start_lng != null) {
            starts.push({ lat: r.start_lat, lng: r.start_lng })
            ids.push(r.id)
          }
        }
        setRemoteShotStarts(starts)
        setRemoteShotIds(ids)
        setPendingForHole(dedupedLocal)
      } catch (err) {
        if (myNonce !== fetchNonceRef.current) return
        // SQLite (pendingShotsForHoleScore) rejection, or any other thrown
        // error — leave counts at the neutral reset above rather than a
        // stale previous-hole value.
        if (__DEV__) {
          console.warn('[hole/shots-fetch]', (err as Error).message)
        }
      }
    })()
  }, [currentHoleScore?.id, shotsRefreshNonce])

  // Derive local shot/putt counts from the pending array — single source
  // of truth, never out of sync with the underlying queue. Putts are
  // counted via @oga/core isPuttShot (lie_type='green').
  const localShotCount = pendingForHole.length

  // Shot waypoints rendered on the map: synced shot starts followed by
  // pending shot starts (in pending insertion order). The current ball
  // is intentionally excluded — HoleMap appends it as the line's final
  // segment so the ball can move while the breadcrumb stays.
  const previousShots = useMemo(() => {
    const out: LatLng[] = [...remoteShotStarts]
    for (const r of pendingForHole) {
      try {
        const p = JSON.parse(r.payload) as ShotPayload
        if (p.start_lat != null && p.start_lng != null) {
          out.push({ lat: p.start_lat, lng: p.start_lng })
        }
      } catch {
        // skip malformed pending payload
      }
    }
    return out
  }, [remoteShotStarts, pendingForHole])

  // Shot client-ids aligned 1:1 with `previousShots` (same order + length), so
  // the summary can map a row to its shot for delete_shot. Remote ids come from
  // the server rows; pending ids from payload.id (always set on insert, db.ts).
  const previousShotIds = useMemo(() => {
    const out: string[] = [...remoteShotIds]
    for (const r of pendingForHole) {
      try {
        const p = JSON.parse(r.payload) as ShotPayload
        if (p.start_lat != null && p.start_lng != null && p.id) {
          out.push(p.id)
        }
      } catch {
        // skip malformed pending payload (matches previousShots)
      }
    }
    return out
  }, [remoteShotIds, pendingForHole])

  // Live tee anchor: the player's first shot's start IS the tee. Falls back to
  // the stored course tee before the first shot (camera + pre-shot distances).
  // useHoleData is live-round-only (past rounds use PastRoundMap), so this is
  // the "GPS-first in live mode" anchor without touching the shared
  // holes.tee_lat — writeTee still only persists for synthetic holes.
  const tee: LatLng | null = previousShots[0] ?? storedTee

  const localPuttCount = useMemo(() => {
    let n = 0
    for (const r of pendingForHole) {
      try {
        const p = JSON.parse(r.payload) as ShotPayload
        if (isPuttShot(p.lie_type)) n++
      } catch {
        // skip malformed pending payload
      }
    }
    return n
  }, [pendingForHole])
  const shotNumber = remoteShotCount + localShotCount + 1

  return {
    round,
    setRound,
    holes,
    setHoles,
    holeScores,
    setHoleScores,
    loading,
    error,
    loadAll,
    holeCount,
    effectiveHoles,
    currentHole,
    currentHoleScore,
    storedPin,
    roundPin,
    tee,
    courseCenter,
    remoteShotCount,
    remotePuttCount,
    remoteShotStarts,
    pendingForHole,
    setPendingForHole,
    previousShots,
    previousShotIds,
    refreshShots,
    localShotCount,
    localPuttCount,
    shotNumber,
  }
}

export type { HoleRow, HoleScoreRow, RoundRow }
