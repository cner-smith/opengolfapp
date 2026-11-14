import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { inferHoleCount, liveHoleShots, resolveCourseTee, resolveHole, roundHoleCount, type LiveHoleShot, type ResolvedHole } from '@oga/core'
import { getHoleTeesForCourse } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import {
  logDiag,
  allShotsForHoleScore,
  listHoleScorePatches,
  type PendingShot,
  type ShotPayload,
} from '../../../lib/db'
import { supabase } from '../../../lib/supabase'
import { syncPendingShots } from '../../../lib/sync'
import { isNetworkFailure, offlineKeys, readCache, writeCache } from '../../../lib/offlineCache'
import { useAuth } from '../../../hooks/useAuth'
import type { LatLng } from '../HoleMap'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']

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
  refreshRound: () => Promise<void>
  holeCount: number
  effectiveHoles: HoleRow[]
  currentHole: HoleRow | null
  currentHoleScore: HoleScoreRow | null
  /** Tee-resolved par/yards/stroke_index/tee-location for currentHole —
   *  hole_tees override for the round's selected tee (if any) over the
   *  base holes row, with hole_scores.par folded in. Additive: consumers
   *  that need raw base values keep reading currentHole directly. */
  resolvedHole: ResolvedHole | null
  /** Same resolution keyed by hole number, for every hole — ScorecardModal
   *  renders all holes, not just currentHole. */
  resolvedHoleByNumber: Map<number, ResolvedHole>
  storedPin: LatLng | null
  roundPin: LatLng | null
  tee: LatLng | null
  courseCenter: LatLng | null
  pendingForHole: PendingShot[]
  setPendingForHole: React.Dispatch<React.SetStateAction<PendingShot[]>>
  /** The hole's shots with a start, server rows then queued ones: start, id,
   *  OB flag and stored club/lie/putt result in one record per shot. The OB
   *  flag comes from the stored rows, so a mid-hole reload must not offer to
   *  mark an already-OB shot again and double-charge the penalty (#839); the
   *  stored club/lie seed the end-of-hole review (#1038). */
  shots: LiveHoleShot[]
  /** Every stored shot row of the hole (server + queued), with a start or not. */
  shotCount: number
  puttCount: number
  /** The hole's latest shot is a made putt (remote or still queued). */
  lastShotHoled: boolean
  /** The hole's latest shot was played from the green. */
  lastShotPutt: boolean
  /** This hole has a score but its shots haven't loaded (still loading, or no
   *  signal and never seen here), so a saved shot would number from zero. */
  shotsOutOfReach: boolean
  /** Refetches the hole's shots; resolves once the refetch has landed in state. */
  refreshShots: () => Promise<void>
  shotNumber: number
}

type CachedRoundData = {
  round: RoundRow & { courses: { lat: number | null; lng: number | null } | null }
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  courseTees: CourseTeeRow[]
  holeTees: HoleTeeRow[]
}

// The shot columns the hole screen reads (the select below).
type LiteShot = Pick<
  Database['public']['Tables']['shots']['Row'],
  'id' | 'club' | 'lie_type' | 'shot_number' | 'start_lat' | 'start_lng' | 'ob' | 'putt_result'
>

function payloadOf(row: PendingShot): ShotPayload | null {
  try {
    return JSON.parse(row.payload) as ShotPayload
  } catch {
    return null
  }
}

async function fetchRoundData(id: string): Promise<CachedRoundData> {
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
  const [hRes, hsRes, ctRes, htRes] = await Promise.all([
    supabase.from('holes').select('*').eq('course_id', r.course_id).order('number'),
    supabase.from('hole_scores').select('*').eq('round_id', r.id),
    supabase.from('course_tees').select('*').eq('course_id', r.course_id),
    getHoleTeesForCourse(supabase, r.course_id),
  ])
  if (hRes.error) throw hRes.error
  if (hsRes.error) throw hsRes.error
  if (ctRes.error) throw ctRes.error
  if (htRes.error) throw htRes.error
  return {
    round: r,
    holes: hRes.data ?? [],
    holeScores: hsRes.data ?? [],
    courseTees: ctRes.data ?? [],
    holeTees: htRes.data ?? [],
  }
}

export function useHoleData(
  id: string | undefined,
  holeNumber: number,
): UseHoleDataResult {
  const { user, offline: authOffline } = useAuth()
  const userId = user?.id
  // Read at call time: loadAll is also the error screen's retry.
  const authOfflineRef = useRef(authOffline)
  authOfflineRef.current = authOffline
  const [round, setRound] = useState<RoundRow | null>(null)
  const [courseCenter, setCourseCenter] = useState<LatLng | null>(null)
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const holeScoresRef = useRef(holeScores)
  holeScoresRef.current = holeScores
  const [courseTees, setCourseTees] = useState<CourseTeeRow[]>([])
  const [holeTees, setHoleTees] = useState<HoleTeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingForHole, setPendingForHole] = useState<PendingShot[]>([])
  // The shots the last load of a hole treated as remote (server rows, or the
  // offline cache's), tagged with their hole score: on a hole switch the
  // caller sees the new hole before this resets. Set = the hole's shots have
  // landed in state (#1005).
  const [remote, setRemote] = useState<{ holeScoreId: string; rows: LiteShot[] } | null>(null)
  const [shotsRefreshNonce, setShotsRefreshNonce] = useState(0)
  // Resolved by the refetch effect once a run that started at or after this
  // refresh settles, so a caller can wait for fresh shots (Done after a move,
  // #1113). Tagged by refresh number: an older run still in flight must not
  // settle it with shots fetched before the move.
  const refreshCountRef = useRef(0)
  const refreshWaitersRef = useRef<{ need: number; resolve: () => void }[]>([])
  const settleRefresh = (through: number) => {
    const ready = refreshWaitersRef.current.filter((w) => w.need <= through)
    refreshWaitersRef.current = refreshWaitersRef.current.filter((w) => w.need > through)
    ready.forEach((w) => w.resolve())
  }
  const refreshShots = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const need = ++refreshCountRef.current
        refreshWaitersRef.current.push({ need, resolve })
        setShotsRefreshNonce(need)
      }),
    [],
  )

  // How many holes this round plays, inferred from the mapped hole numbers
  // (course_tees.par is unpopulated in our crawled data) — a genuine 9-hole
  // course stays 9 instead of padding to 18 phantom holes (#525). The
  // round's stored count (#727) caps it — a 6-hole round shows 6, even on an
  // 18-hole course — but never raises it: mobile has no ensureRealHole, so a
  // padded hole with no hole_scores row drops its shots silently (a web
  // round stored as 18 on a course mapped only to hole 9).
  const holeCount = useMemo(() => {
    const inferred = inferHoleCount(holes.map((h) => h.number))
    return Math.min(roundHoleCount(round?.hole_count, inferred), inferred)
  }, [round?.hole_count, holes])

  // Synthetic-holes fallback. Mirrors the web pattern documented in
  // CLAUDE.md: when the course has fewer real `holes` rows than the
  // expected count, pad with par-4 placeholders keyed
  // `synthetic-${roundId}-hole-${n}` so the UI can render and the player
  // isn't trapped on a "Hole not found" screen.
  const effectiveHoles = useMemo<HoleRow[]>(() => {
    if (!round) return holes
    const own = holes.filter((h) => h.number <= holeCount)
    if (own.length >= holeCount) return own
    const realByNumber = new Map<number, HoleRow>()
    for (const h of own) realByNumber.set(h.number, h)
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

  // Resolve which course_tees row this round is playing (id preferred,
  // tee_color as legacy fallback), then that tee's hole_tees override (if
  // any) for the current hole. Sparse by design — most courses have none
  // yet, so this is a no-op for the common case and everything falls
  // through to the base `holes` row.
  const resolvedCourseTee = useMemo(
    () => resolveCourseTee(courseTees, round?.course_tee_id, round?.tee_color),
    [courseTees, round?.course_tee_id, round?.tee_color],
  )
  const holeTeeByHoleId = useMemo(() => {
    const m = new Map<string, HoleTeeRow>()
    if (!resolvedCourseTee) return m
    for (const ht of holeTees) {
      if (ht.course_tee_id === resolvedCourseTee.id) m.set(ht.hole_id, ht)
    }
    return m
  }, [holeTees, resolvedCourseTee])
  const resolvedHole = useMemo(
    () =>
      currentHole
        ? resolveHole(currentHole, holeTeeByHoleId.get(currentHole.id) ?? null, {
            par: currentHoleScore?.par,
          })
        : null,
    [currentHole, holeTeeByHoleId, currentHoleScore?.par],
  )

  // Same resolution for every hole (no live drag override — that only
  // applies to whichever hole is currently being edited) — for consumers
  // that render/sum over all holes (ScorecardModal) rather than just the
  // current one.
  const resolvedHoleByNumber = useMemo(() => {
    const m = new Map<number, ResolvedHole>()
    for (const h of effectiveHoles) {
      const teeOverride = holeTeeByHoleId.get(h.id) ?? null
      const hs = holeScores.find((s) => s.hole_id === h.id)
      m.set(h.number, resolveHole(h, teeOverride, { par: hs?.par }))
    }
    return m
  }, [effectiveHoles, holeTeeByHoleId, holeScores])

  const storedPin: LatLng | null =
    currentHole?.pin_lat != null && currentHole.pin_lng != null
      ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
      : null
  const roundPin: LatLng | null =
    currentHoleScore?.pin_lat != null && currentHoleScore.pin_lng != null
      ? { lat: currentHoleScore.pin_lat, lng: currentHoleScore.pin_lng }
      : null
  // The course's stored tee (OSM-mapped or synthetic, tee-resolved — a
  // hole_tees override for this tee wins over the base holes.tee_lat/lng).
  // Used as the pre-shot fallback; once the player has hit, the live tee
  // is their first shot's start (see `tee` below) — most courses now
  // carry an OSM tee, and pinning the marker there instead of where the
  // player actually teed off is wrong for the live round.
  const storedTee: LatLng | null =
    resolvedHole?.teeLat != null && resolvedHole?.teeLng != null
      ? { lat: resolvedHole.teeLat, lng: resolvedHole.teeLng }
      : null

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    // Set together, not before the fetch below: a render with a round but no
    // holes yet pads to synthetic placeholders, and the synthetic → real id
    // swap for the SAME hole reads as a hole switch to useHoleState, dropping
    // a resumed mid-hole into "+ Add a shot" (#902).
    const apply = (p: CachedRoundData) => {
      setRound(p.round)
      setCourseCenter(
        p.round.courses && p.round.courses.lat != null && p.round.courses.lng != null
          ? { lat: p.round.courses.lat, lng: p.round.courses.lng }
          : null,
      )
      setHoles(p.holes)
      setHoleScores(p.holeScores)
      setCourseTees(p.courseTees)
      setHoleTees(p.holeTees)
    }
    try {
      // Signed in from the stored session (#1005): every fetch would first
      // wait out auth-js's failed refresh, so try the cache first.
      const saved = authOfflineRef.current && userId
        ? await readCache<CachedRoundData>(offlineKeys.round(userId, id))
        : null
      if (saved) return apply(saved)
      apply(await fetchRoundData(id))
    } catch (err) {
      // Offline (#993): reopen the round from its last successful load.
      const cached =
        userId && isNetworkFailure(err)
          ? await readCache<CachedRoundData>(offlineKeys.round(userId, id))
          : null
      if (cached) apply(cached)
      else setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id, userId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Signal back after an offline start (#1005): catch up with the server
  // behind the player. Never touches `loading`, which would swap the map for
  // the loading screen mid-round, or the hole. Course rows stay as they are: a
  // tee set while offline only lives in them. The queue goes first, so the rows
  // read here include it; a queued patch still left means the server is behind
  // this phone, so its scores wait for the next load. So do they if the scores
  // changed meanwhile: an edit whose patch flushed before the read below is in
  // no queue, and the fetched rows may predate it. A failure just keeps what's
  // on screen.
  const refreshRound = useCallback(async () => {
    if (!id) return
    const scoresBefore = holeScoresRef.current
    try {
      await syncPendingShots()
      const fresh = await fetchRoundData(id)
      if (!(await listHoleScorePatches()).some((p) => p.round_id === id)) {
        setRound(fresh.round)
        setHoleScores((cur) => (cur === scoresBefore ? fresh.holeScores : cur))
      }
    } catch (err) {
      logDiag('refresh_round_failed', { msg: (err as Error).message.slice(0, 120) })
    }
    await refreshShots()
  }, [id, refreshShots])

  // Persist the loaded round for a cold start without signal (#993). Follows
  // the in-memory state rather than only loadAll's fetch, so the scores, pins
  // and tees edited during play are what an offline reopen gets back.
  useEffect(() => {
    if (!userId || !round) return
    const payload: CachedRoundData = {
      round: round as CachedRoundData['round'],
      holes,
      holeScores,
      courseTees,
      holeTees,
    }
    void writeCache(offlineKeys.round(userId, round.id), payload)
  }, [userId, round, holes, holeScores, courseTees, holeTees])

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
  // Tracks which hole_score id the reset-to-neutral block below has already
  // run for, so a same-hole refresh (shotsRefreshNonce bump, e.g. after
  // moveShot/deleteShot from the live-round edit-mode stepper) doesn't
  // re-trigger it. Without this scoping, the hole's shots would flash to
  // empty for the whole fetch RTT on every move/delete — dropping
  // `hasPriorShots` to false and kicking the player briefly out of edit mode
  // mid-action (shots.length > 0 is part of that predicate).
  const resetForHoleScoreIdRef = useRef<string | null>(null)
  useEffect(() => {
    const holeScoreId = currentHoleScore?.id ?? null
    if (resetForHoleScoreIdRef.current !== holeScoreId) {
      resetForHoleScoreIdRef.current = holeScoreId
      // Reset to the neutral "unknown" state synchronously, before the async
      // fetch below resolves. Without this, a hole switch during the fetch
      // RTT leaves the PREVIOUS hole's counts in state — e.g. `hasPriorShots`
      // (LiveRoundSession) reads a stale true/false and the tee-default effect
      // can place a ball marker on a hole the player is only reviewing (#720
      // item 2). 0/[] also matches the true pre-fetch state of a fresh hole,
      // so this isn't a behavior change for the common case. Scoped to an
      // actual hole_score id change (see ref above) — a same-hole refresh
      // keeps showing the last-known-good shots while the refetch is in
      // flight instead.
      setRemote(null)
      setPendingForHole([])
    }
    if (!currentHoleScore) {
      settleRefresh(Infinity)
      return
    }
    const myNonce = ++fetchNonceRef.current
    const fetchT0 = Date.now()
    ;(async () => {
      try {
        const fetchShots = () =>
          supabase
            .from('shots')
            .select('id, club, lie_type, shot_number, start_lat, start_lng, ob, putt_result')
            .eq('hole_score_id', currentHoleScore.id)
            .order('shot_number')
        // Signed in from the stored session (#1005): with this hole cached,
        // skip the fetch, which would first wait out auth-js's failed refresh;
        // the cache below answers as for a network failure. Uncached, still
        // fetch: an empty answer here would read as a confident remote=0.
        const hasCache = authOfflineRef.current && userId && id
          ? (await readCache<LiteShot[]>(offlineKeys.holeShots(userId, id, currentHoleScore.id))) !== null
          : false
        if (myNonce !== fetchNonceRef.current) return
        let shotsRes = hasCache ? null : await fetchShots()
        if (myNonce !== fetchNonceRef.current) return
        // postgrest-js returns failures in-band ({data: null, error}) — the
        // promise resolves normally, so this can't be caught by the outer
        // try/catch. One retry covers most transient failures (mirrors the
        // sync.ts chunk-upsert retry); a network failure skips it, since
        // postgrest-js has already retried the GET itself.
        if (shotsRes?.error && !isNetworkFailure(shotsRes.error, shotsRes.status)) {
          shotsRes = await fetchShots()
          if (myNonce !== fetchNonceRef.current) return
        }
        const offline = !!userId && !!id &&
          (!shotsRes || (!!shotsRes.error && isNetworkFailure(shotsRes.error, shotsRes.status)))
        const cached = offline && userId && id
          ? await readCache<LiteShot[]>(offlineKeys.holeShots(userId, id, currentHoleScore.id))
          : null
        if (myNonce !== fetchNonceRef.current) return
        // The local queue is read AFTER the server answers (#1113): a shot
        // saved while the fetch was in flight is then in this read. Read
        // alongside the fetch, the older snapshot overwrote pendingForHole and
        // dropped that shot, so the next one reused its shot number. Nothing
        // is awaited between this read and the state writes below. Synced
        // rows are read too: one that synced after the server's read is in
        // neither list otherwise; the remoteIds dedupe below drops the rest.
        // ponytail: a synced row deleted on another device shows until the
        // next app start purges synced rows.
        // The SQLite read gets one retry: a transient rejection must not leave
        // the neutral reset committed as a confident local=0 the save path
        // could collide on (same class as the remote arm of #712).
        let local = await allShotsForHoleScore(currentHoleScore.id).catch(() => null)
        if (myNonce !== fetchNonceRef.current) return
        if (local === null) {
          local = await allShotsForHoleScore(currentHoleScore.id).catch(
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
        let shots: LiteShot[]
        if (shotsRes && !shotsRes.error) {
          shots = shotsRes.data ?? []
        } else if (offline && !cached && !local.length && currentHoleScore.score > 0) {
          // Offline on a hole with a score that this phone never loaded: it was
          // played elsewhere. Committing remote=0 here numbers the next shot 1,
          // which the sync quarantines on unique(hole_score_id, shot_number),
          // while its score patch overwrites the real score (#1005). Caching
          // that 0 would outlive this load too.
          logDiag('refetch_offline', { cached: null, outOfReach: true })
          return
        } else if (offline) {
          // Offline (#993): the shots this device last knew for the hole
          // (server rows + ones it queued, written below), minus the ones
          // still queued — those come from `local` like online.
          const queuedIds = new Set(local.flatMap((p) => payloadOf(p)?.id ?? []))
          logDiag('refetch_offline', { cached: cached?.length ?? null })
          shots = (cached ?? []).filter((s) => !queuedIds.has(s.id))
        } else {
          // Failed twice: leave counts at the neutral reset above rather
          // than committing a confident remote=0 that the save path could
          // collide on.
          const failure = shotsRes?.error?.message ?? 'no shots read'
          if (__DEV__) {
            console.warn('[hole/shots-fetch]', failure)
          }
          logDiag('refetch_failed', { msg: failure.slice(0, 120) })
          return
        }
        // Dedupe the sync-in-flight window: a shot whose server row just
        // committed can still be 'pending' locally for a beat before
        // markShotSynced runs (lib/sync.ts marks rows synced one at a time
        // after the chunk upsert). Both payload.id (client-generated, set
        // before every insert) and the remote row's id are compared so a
        // mid-sync shot counts once, not twice (#714).
        const remoteIds = new Set(shots.map((s) => s.id))
        const dedupedLocal = local.filter((p) => {
          const payload = payloadOf(p)
          return !payload?.id || !remoteIds.has(payload.id)
        })
        setRemote({ holeScoreId: currentHoleScore.id, rows: shots })
        setPendingForHole(dedupedLocal)
        logDiag('refetch', { remote: shots.length, local: dedupedLocal.length, ms: Date.now() - fetchT0 })
      } catch (err) {
        logDiag('refetch_failed', { msg: err })
        if (myNonce !== fetchNonceRef.current) return
        // SQLite (allShotsForHoleScore) rejection, or any other thrown
        // error — leave counts at the neutral reset above rather than a
        // stale previous-hole value.
        if (__DEV__) {
          console.warn('[hole/shots-fetch]', (err as Error).message)
        }
      } finally {
        if (myNonce === fetchNonceRef.current) settleRefresh(shotsRefreshNonce)
      }
    })()
  }, [currentHoleScore?.id, shotsRefreshNonce, userId, id])

  // Persist the current hole's shots — the loaded remote ones plus every
  // queued one — so a cold start without signal (#993) still knows them,
  // including queued shots that sync and are purged from SQLite before then.
  // Runs on each load and on every queue change (the save path appends to
  // pendingForHole without a refetch). Skips until this hole has loaded.
  useEffect(() => {
    const hsId = currentHoleScore?.id
    if (!userId || !id || !hsId || remote?.holeScoreId !== hsId) return
    const queued = pendingForHole.flatMap((row): LiteShot[] => {
      const p = payloadOf(row)
      if (!p?.id) return []
      return [{
        id: p.id,
        club: p.club ?? null,
        lie_type: p.lie_type ?? null,
        shot_number: p.shot_number,
        start_lat: p.start_lat ?? null,
        start_lng: p.start_lng ?? null,
        ob: p.ob ?? false,
        putt_result: p.putt_result ?? null,
      }]
    })
    void writeCache(offlineKeys.holeShots(userId, id, hsId), [...remote.rows, ...queued])
  }, [remote, pendingForHole, currentHoleScore?.id, userId, id])

  // The hole's shots as one list (server rows, then the queue in insertion
  // order), so a shot's start, id and OB flag can't drift apart: the list's
  // order decides which shot the OB key flags and which review row sets the
  // hole score (#839). The current ball is not in it: HoleMap appends it as
  // the line's final segment so the ball can move while the breadcrumb stays.
  const holeShots = useMemo(
    () => liveHoleShots(currentHoleScore?.id ?? null, remote, pendingForHole.map((p) => p.payload)),
    [currentHoleScore?.id, remote, pendingForHole],
  )

  // Live tee anchor: the player's first shot's start IS the tee. Falls back to
  // the stored course tee before the first shot (camera + pre-shot distances).
  // useHoleData is live-round-only (past rounds use PastRoundMap), so this is
  // the "GPS-first in live mode" anchor without touching the shared
  // holes.tee_lat — writeTee still only persists for synthetic holes.
  const tee: LatLng | null = holeShots.shots[0]?.start ?? storedTee
  // Every stored row takes a number, placed on the map or not: numbering off
  // the placed list would reuse a number and the sync would quarantine the
  // shot on unique(hole_score_id, shot_number).
  const shotNumber = holeShots.count + 1

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
    refreshRound,
    holeCount,
    effectiveHoles,
    currentHole,
    currentHoleScore,
    resolvedHole,
    resolvedHoleByNumber,
    storedPin,
    roundPin,
    tee,
    courseCenter,
    pendingForHole,
    setPendingForHole,
    shots: holeShots.shots,
    shotCount: holeShots.count,
    puttCount: holeShots.putts,
    lastShotHoled: holeShots.lastHoled,
    lastShotPutt: holeShots.lastPutt,
    shotsOutOfReach: !!currentHoleScore?.score && remote?.holeScoreId !== currentHoleScore.id && !pendingForHole.length,
    refreshShots,
    shotNumber,
  }
}

export type { HoleRow, HoleScoreRow, RoundRow }
