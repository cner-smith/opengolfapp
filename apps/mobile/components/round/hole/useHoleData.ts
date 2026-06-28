import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { inferHoleCount } from '@oga/core'
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
    if (!currentHoleScore) return
    const myNonce = ++fetchNonceRef.current
    ;(async () => {
      const [shotsRes, local] = await Promise.all([
        supabase
          .from('shots')
          .select('club, lie_type, shot_number, start_lat, start_lng')
          .eq('hole_score_id', currentHoleScore.id)
          .order('shot_number'),
        pendingShotsForHoleScore(currentHoleScore.id),
      ])
      if (myNonce !== fetchNonceRef.current) return
      const shots = shotsRes.data ?? []
      setRemoteShotCount(shots.length)
      setRemotePuttCount(
        shots.filter((s) => s.club === 'putter' || s.lie_type === 'green').length,
      )
      const starts: LatLng[] = []
      for (const r of shots) {
        if (r.start_lat != null && r.start_lng != null) {
          starts.push({ lat: r.start_lat, lng: r.start_lng })
        }
      }
      setRemoteShotStarts(starts)
      setPendingForHole(local)
    })()
  }, [currentHoleScore?.id])

  // Derive local shot/putt counts from the pending array — single source
  // of truth, never out of sync with the underlying queue. Putts are
  // counted as shots where club='putter' OR lie_type='green'.
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
        if (p.club === 'putter' || p.lie_type === 'green') n++
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
    localShotCount,
    localPuttCount,
    shotNumber,
  }
}

export type { HoleRow, HoleScoreRow, RoundRow }
