import { useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import type { User } from '@supabase/supabase-js'
import { isPuttShot, projectShotMove } from '@oga/core'
import { supabase } from '../../../lib/supabase'
import {
  deletePendingShotById,
  enqueueHoleScorePatch,
  removeLocalShotAndRenumber,
  setPendingShotOb,
  type ShotPayload,
} from '../../../lib/db'
import { syncPendingShots } from '../../../lib/sync'
import type { LatLng } from '../HoleMap'
import type { UseHoleDataResult } from './useHoleData'

interface UseShotEditsInput {
  user: User | null
  data: UseHoleDataResult
  // The component's manual ball-placement path; markLastShotOb uses it to
  // drop the ball back on the OB shot's origin (see useShotActions' input).
  placeBallManually: (loc: LatLng) => void
}

export interface UseShotEditsResult {
  // Online-first single-shot delete: flush pending, call the delete_shot RPC,
  // refresh the hole's shot state. Returns true on success, false (with an
  // alert already shown) on network/error.
  deleteShot: (shotId: string) => Promise<boolean>
  // Online-first single-shot reposition: recompute start coords (+
  // distance_to_target via projectShotMove) and write them directly.
  // Returns true on success, false (with an alert already shown) on
  // network/error.
  moveShot: (
    shotId: string,
    newStart: { lat: number; lng: number },
  ) => Promise<boolean>
  // Online-first toggle of the OB flag on this hole's most recent shot, plus
  // its stroke-and-distance bookkeeping (#839). See the implementation for
  // why it writes two representations of the same fact.
  markLastShotOb: () => Promise<void>
  // Whether that most recent shot is currently flagged OB — the chip's
  // set-vs-undo label. Exposed from here rather than read off the fetched
  // data directly so the label and the toggle's direction can never disagree
  // (they share one source, including the just-written optimistic value).
  lastShotIsOb: boolean
  // The same OB truth for EVERY shot on the hole, index-aligned with
  // data.previousShots / previousShotIds. Exposed for the same reason
  // lastShotIsOb is: the end-of-hole summary seeds its rows from this, and
  // reading the fetched flags directly would let it re-seed the score ticker
  // to the struck count during the window before a just-written OB refetches.
  shotObs: boolean[]
}

// Online-first edits to shots already logged on the current hole: delete,
// move, and the OB toggle. Split out of useShotActions (#1015).
export function useShotEdits({ user, data, placeBallManually }: UseShotEditsInput): UseShotEditsResult {
  const {
    currentHoleScore,
    setHoleScores,
    pendingForHole,
    storedPin,
    roundPin,
    previousShots,
    previousShotIds,
    previousShotObs,
  } = data
  // Serializes OB toggles: blocks a tap that arrives while one is in flight,
  // and (because the hole_scores write below is awaited inside the same
  // window) guarantees a set→undo pair reaches the server in the order it was
  // issued rather than in whatever order two unordered writes happen to land.
  const obInFlightRef = useRef(false)
  // The OB flag we last WROTE for a shot, which outranks the fetched value
  // until the refetch catches up. `previousShotObs` only refreshes when the
  // post-write `refreshShots` round-trip lands — a whole extra RTT after the
  // write resolved and the in-flight gate released. Reading the fetched value
  // in that window is what made the penalty chargeable twice: a second tap
  // recomputed `next = true` against stale data, the update matched its (still
  // ob=true) row so the 0-row guard passed, and the score took a second +1.
  // Ref = the synchronous truth the next toggle's direction is computed from
  // (a state setter commits a tick late, which is the whole double-tap
  // problem); state = the render-visible mirror, so the chip's label flips the
  // instant the write succeeds instead of an RTT later. Same ref-for-decisions
  // / state-for-render split as persistShotInFlightRef vs `saving` above.
  // Keyed on the shot id, so it simply stops applying once a newer shot is
  // logged, and needs no explicit invalidation: by the time the refetch lands
  // it agrees with the fetched value anyway.
  const obOverrideRef = useRef<{ shotId: string; ob: boolean } | null>(null)
  const [obOverride, setObOverride] = useState<{
    shotId: string
    ob: boolean
  } | null>(null)
  // Effective OB flag per shot on this hole, index-aligned with
  // previousShotIds: our own last write for a shot outranks the fetched value
  // until the refetch catches up (see obOverrideRef above). One array so the
  // chip's label and every score term below read the same truth.
  // Memoized so consumers can use it as a dependency (the end-of-hole
  // summary rebuilds its rows off it) without recomputing every render.
  const shotObs = useMemo(
    () =>
      previousShotIds.map((shotId, i) =>
        obOverride?.shotId === shotId ? obOverride.ob : previousShotObs[i] ?? false,
      ),
    [previousShotIds, previousShotObs, obOverride],
  )

  async function deleteShot(shotId: string): Promise<boolean> {
    try {
      // Flush any not-yet-synced shots so the target has a server row to delete.
      await syncPendingShots()
      const { data: deleted, error } = await supabase.rpc('delete_shot', {
        p_shot_id: shotId,
      })
      if (error) throw error
      // If the RPC found nothing on the server (false), the shot never synced —
      // drop its local pending row so it actually disappears. Otherwise mirror
      // the RPC's delete + renumber onto the local queue copies.
      if (deleted === false) await deletePendingShotById(shotId)
      else await removeLocalShotAndRenumber(shotId)
      data.refreshShots()
      // refreshShots only refetches SHOTS; the RPC also re-tallied hole_scores
      // (score/putts/penalties/fairway_hit/gir) server-side, and that row is
      // fetched by a separate effect refreshShots doesn't trigger. Refetch it so
      // the scorecard score updates instead of staying stale after the delete.
      const hsId = data.currentHoleScore?.id
      if (hsId) {
        const { data: updatedHs } = await supabase
          .from('hole_scores')
          .select('*')
          .eq('id', hsId)
          .single()
        if (updatedHs) {
          setHoleScores((prev) =>
            prev.map((hs) => (hs.id === hsId ? { ...hs, ...updatedHs } : hs)),
          )
        }
      }
      return true
    } catch (e) {
      if (__DEV__) console.warn('[hole/deleteShot]', (e as Error)?.message)
      Alert.alert(
        "Couldn't delete that shot",
        'Deleting a shot needs a connection. Try again when you’re back online.',
      )
      return false
    }
  }

  // Online-first single-shot reposition: recompute the shot's start coords
  // (+ distance_to_target, via the pure projectShotMove) and write them
  // directly with a `.update()` — no RPC, since a move only touches columns
  // on the shot's own row (unlike delete_shot's renumber/re-tally fan-out).
  // Mirrors deleteShot's online-only pattern: try → Alert + return false on
  // error → data.refreshShots() → return boolean.
  async function moveShot(
    shotId: string,
    newStart: { lat: number; lng: number },
  ): Promise<boolean> {
    if (!user) return false
    try {
      // Flush any not-yet-synced shots first (mirrors deleteShot) — the shot's
      // client-generated id is stable, so once flushed the update below hits
      // the real server row instead of matching 0 rows.
      await syncPendingShots()
      // The shot's lie_type (putt vs. full shot) isn't held in memory for an
      // already-synced shot — only pending (not-yet-synced) shots carry it,
      // via their queued payload, and even there it's commonly null (live
      // shots are location-only until the end-of-hole review fills it in —
      // so a `null` from the loop below is a real found value, not a
      // "keep looking" signal). Fall back to a direct read only when the
      // shotId genuinely isn't in the pending queue (already synced).
      let lieType: string | null = null
      let foundLocally = false
      for (const p of pendingForHole) {
        try {
          const payload = JSON.parse(p.payload) as ShotPayload
          if (payload.id === shotId) {
            lieType = payload.lie_type ?? null
            foundLocally = true
            break
          }
        } catch {
          // skip malformed pending payload
        }
      }
      if (!foundLocally) {
        const { data: shotRow, error: shotErr } = await supabase
          .from('shots')
          .select('lie_type')
          .eq('id', shotId)
          .single()
        if (shotErr || !shotRow) throw shotErr ?? new Error('Shot not found')
        lieType = shotRow.lie_type
      }
      // Same pin source buildPayload uses for a fresh shot's distance_to_target.
      const pinTarget = roundPin ?? storedPin ?? null
      const proj = projectShotMove({
        newStart,
        pin: pinTarget,
        isPutt: isPuttShot(lieType),
      })
      const updates: { start_lat: number; start_lng: number; distance_to_target?: number | null } = {
        start_lat: proj.startLat,
        start_lng: proj.startLng,
      }
      // undefined = leave distance_to_target untouched (#662 no-pin guard)
      if (proj.distanceToTarget !== undefined) {
        updates.distance_to_target = proj.distanceToTarget
      }
      const { data: updatedRows, error } = await supabase
        .from('shots')
        .update(updates)
        .eq('id', shotId)
        .eq('user_id', user.id)
        .select('id')
      if (error) throw error
      // A matched-0-rows update returns error === null with empty data — the
      // synced shot still isn't on the server (or belongs to another user).
      // Surface it as a failure rather than silently "succeeding" while the
      // move is lost (mirrors the Alert path below).
      if (!updatedRows || updatedRows.length === 0) {
        if (__DEV__) console.warn('[hole/moveShot] update matched 0 rows', shotId)
        Alert.alert(
          "Couldn't move that shot",
          'Moving a shot needs a connection. Try again when you’re back online.',
        )
        return false
      }
      data.refreshShots()
      return true
    } catch (e) {
      if (__DEV__) console.warn('[hole/moveShot]', (e as Error)?.message)
      Alert.alert(
        "Couldn't move that shot",
        'Moving a shot needs a connection. Try again when you’re back online.',
      )
      return false
    }
  }

  // Live out-of-bounds (#839). The affordance can exist at all because
  // persistShot writes the shot row on confirmAim/skipAim — BEFORE the ball
  // is struck — with `start` = the ball the player just marked. So when a
  // shot flies OB the player is still standing at that shot's origin, and
  // stroke-and-distance is nothing more than "flag it, charge the stroke,
  // put the ball back where it was".
  //
  // Online-first, exactly like its siblings deleteShot / moveShot: flush the
  // pending queue so the target has a server row, write it directly, and fail
  // visibly on a 0-row response rather than pretending it worked. Second tap
  // undoes.
  async function markLastShotOb() {
    if (!user || !currentHoleScore) return
    if (obInFlightRef.current) return
    // The hole's most recent shot. previousShotIds/previousShotObs/previousShots
    // are built index-aligned in useHoleData, and #852's up-front id stamp is
    // what puts a just-saved (still pending) shot in them at all — its payload
    // carries the client id from the moment it is queued, so the shot the
    // player is standing at IS the last entry here. No id is derived or minted.
    const idx = previousShotIds.length - 1
    const shotId = previousShotIds[idx]
    if (!shotId) return
    const start = previousShots[idx] ?? null
    // Direction comes from the last value WE WROTE when there is one for this
    // shot, never from the possibly-stale fetched value — see obOverrideRef.
    const currentlyOb =
      obOverrideRef.current?.shotId === shotId
        ? obOverrideRef.current.ob
        : previousShotObs[idx] ?? false
    const next = !currentlyOb
    obInFlightRef.current = true
    try {
      // Flush first (mirrors moveShot): the client id is stable, so once the
      // shot has synced the update below hits the real row instead of 0 rows.
      await syncPendingShots()
      const { data: updatedRows, error } = await supabase
        .from('shots')
        // BOTH representations of the same fact, deliberately:
        //   `ob`          — what the SG engine reads (sg-calculator charges
        //                   an OB shot exactly −2, stroke and distance).
        //   `shot_result` — what round-trips through ReviewedShotRow, the row
        //                   type the end-of-hole review sheet is built from,
        //                   which has NO `ob` field at all. The score ticker
        //                   can only see the penalty through this string.
        // buildPayload derives the boolean from the string on the way in, so
        // writing both keeps one consistent fact rather than two sources of
        // truth. Clearing restores shot_result to null: SHOT_RESULTS is
        // single-select, so 'ob' had already displaced any ball-flight result
        // and there is nothing to restore it from — undo is lossy that way.
        .update({ ob: next, shot_result: next ? 'ob' : null })
        .eq('id', shotId)
        .eq('user_id', user.id)
        .select('id')
      if (error) throw error
      // Matched 0 rows: error === null with empty data (same silent-success
      // shape moveShot guards against, #710). Surface it instead of leaving
      // the player believing the penalty was recorded.
      if (!updatedRows || updatedRows.length === 0) {
        if (__DEV__) console.warn('[hole/markLastShotOb] update matched 0 rows', shotId)
        Alert.alert(
          "Couldn't record that penalty",
          'Marking a shot OB needs a connection. Try again when you’re back online.',
        )
        return
      }
      // The write landed — record it as the authoritative flag for this shot
      // BEFORE anything can be tapped again, so the next toggle reverses it
      // instead of repeating it. The ref is what the decision above reads; the
      // state mirror is what re-renders the chip's label.
      obOverrideRef.current = { shotId, ob: next }
      setObOverride({ shotId, ob: next })
      // Patch the local queue copy too. saveHoleSummary pairs each reviewed
      // row back to its LOCAL payload first and only falls back to the remote
      // row — so without this the stale local `ob: false` would erase the flag
      // at the very next end-of-hole save.
      await setPendingShotOb(shotId, next).catch(() => undefined)
      // Score ±1 for the penalty stroke, mirrored optimistically the way
      // persistShot does. Queued (#226): the drain merges a hole's patches in
      // enqueue order, so a set-then-undo reaches the server as the last tap,
      // never whichever request happened to arrive last.
      const nextScore = Math.max(0, currentHoleScore.score + (next ? 1 : -1))
      setHoleScores((prev) =>
        prev.map((hs) =>
          hs.id === currentHoleScore.id ? { ...hs, score: nextScore } : hs,
        ),
      )
      await enqueueHoleScorePatch(currentHoleScore, { score: nextScore })
      syncPendingShots().catch(() => undefined)
      data.refreshShots()
      // Stroke and distance: the re-hit starts where the OB shot started, so
      // drop the ball back there and freeze GPS on it (the same manual-
      // placement path a drag uses) or the next fix would drag it away. On
      // UNDO the ball is left exactly where it is — reversing the flag and
      // the stroke is the undo; moving the player's map is not.
      if (next && start) placeBallManually(start)
    } catch (e) {
      if (__DEV__) console.warn('[hole/markLastShotOb]', (e as Error)?.message)
      Alert.alert(
        "Couldn't record that penalty",
        'Marking a shot OB needs a connection. Try again when you’re back online.',
      )
    } finally {
      obInFlightRef.current = false
    }
  }

  // The chip's label, read off the SAME shotObs array markLastShotOb resolves
  // the toggle's direction from: our own last write for this shot wins over
  // the fetched value until the refetch catches up. Sharing one rule is the
  // point — a label saying "Last shot went OB" while the handler would treat
  // it as an undo (or vice versa) is exactly how a second tap became a second
  // penalty.
  const lastShotIsOb = shotObs[shotObs.length - 1] ?? false

  return { deleteShot, moveShot, markLastShotOb, lastShotIsOb, shotObs }
}
