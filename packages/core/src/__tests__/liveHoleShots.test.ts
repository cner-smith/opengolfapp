import { describe, expect, it } from 'vitest'
import { liveHoleShots, type LiveShotRow } from '../live-ball'

// Positions near Whistling Straits hole 1.
const TEE = { lat: 43.849856, lng: -87.734575 }
const FAIRWAY = { lat: 43.84906, lng: -87.733 }
const DROP = { lat: 43.8488, lng: -87.7326 }
const GREEN = { lat: 43.8481, lng: -87.7311 }
const HS = 'hs-1'

const row = (id: string, at: { lat: number; lng: number } | null, extra: Partial<LiveShotRow> = {}): LiveShotRow => ({
  id,
  club: null,
  lie_type: null,
  start_lat: at?.lat ?? null,
  start_lng: at?.lng ?? null,
  ob: false,
  putt_result: null,
  ...extra,
})
// A queued payload as the phone's SQLite queue stores it (a shots insert, as JSON).
const queued = (id: string | undefined, at: { lat: number; lng: number } | null, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    id,
    hole_score_id: HS,
    user_id: 'u1',
    shot_number: 0,
    start_lat: at?.lat ?? null,
    start_lng: at?.lng ?? null,
    ...extra,
  })
const server = (...rows: LiveShotRow[]) => ({ holeScoreId: HS, rows })
const ids = (r: ReturnType<typeof liveHoleShots>) => r.shots.map((s) => s.id)
const obs = (r: ReturnType<typeof liveHoleShots>) => r.shots.map((s) => s.ob)

describe('liveHoleShots: one list of the live hole shots', () => {
  it('server rows come first, then queued shots in queue order; the next shot is count + 1', () => {
    // 2 server rows + 1 queued = 3 stored → the next shot is number 4.
    const r = liveHoleShots(HS, server(row('s1', TEE), row('s2', FAIRWAY)), [queued('q3', GREEN)])
    expect(ids(r)).toEqual(['s1', 's2', 'q3'])
    expect(r.shots.map((s) => s.start)).toEqual([TEE, FAIRWAY, GREEN])
    expect(r.count).toBe(3)
  })

  it('OB then re-tee: the penalty flag stays on the OB shot, the replay from the same spot is clean', () => {
    // Shot 1 from the tee went OB (synced); shot 2 is the re-tee from the same tee, still queued.
    const r = liveHoleShots(HS, server(row('s1', TEE, { ob: true })), [queued('q2', TEE)])
    expect(ids(r)).toEqual(['s1', 'q2'])
    expect(obs(r)).toEqual([true, false])
    expect(r.shots[1]!.start).toEqual(r.shots[0]!.start)
    // Struck rows only (penalty strokes are added by the caller): 2 rows → next shot 3.
    expect(r.count).toBe(2)
  })

  it('an OB marked on a still-queued shot lands on that shot', () => {
    // The OB key patches `ob` into the queued payload before it syncs.
    const r = liveHoleShots(HS, server(row('s1', TEE)), [queued('q2', FAIRWAY, { ob: true }), queued('q3', FAIRWAY)])
    expect(obs(r)).toEqual([false, true, false])
  })

  it('a row with no start counts for numbering but is not on the map, and the flags after it stay on their own shots', () => {
    // s2 has no start (never placed). Stored rows: s1, s2, s3, q4 = 4 → next 5. Placed: s1, s3, q4.
    // OB is on s3: in the placed list that is index 1, not index 2.
    const r = liveHoleShots(
      HS,
      server(row('s1', TEE), row('s2', null), row('s3', FAIRWAY, { ob: true })),
      [queued('q4', FAIRWAY)],
    )
    expect(ids(r)).toEqual(['s1', 's3', 'q4'])
    expect(obs(r)).toEqual([false, true, false])
    expect(r.count).toBe(4)
  })

  it('a drop: the shot after a penalty is played from the drop spot', () => {
    const r = liveHoleShots(HS, server(row('s1', TEE), row('s2', FAIRWAY)), [queued('q3', DROP)])
    expect(r.shots[2]).toEqual({
      id: 'q3',
      start: DROP,
      ob: false,
      captured: { club: null, lie_type: null, putt_result: null },
    })
  })

  it('after a delete the next number follows what is stored, not the deleted shot', () => {
    // Shot 2 of 3 was deleted; delete_shot renumbered the server to 1, 2. With one queued
    // shot: 2 + 1 = 3 stored → next 4.
    const r = liveHoleShots(HS, server(row('s1', TEE), row('s3', FAIRWAY)), [queued('q4', GREEN)])
    expect(ids(r)).toEqual(['s1', 's3', 'q4'])
    expect(r.count).toBe(3)
  })

  it('a queued payload without an id counts but is not listed; a malformed one is ignored', () => {
    // Stored: s1 + the id-less one = 2 (the malformed one is not a shot of this hole).
    const r = liveHoleShots(HS, server(row('s1', TEE)), [queued(undefined, FAIRWAY), '{not json'])
    expect(ids(r)).toEqual(['s1'])
    expect(r.count).toBe(2)
  })

  it('carries the stored club, lie and putt result per shot (#1038)', () => {
    const r = liveHoleShots(
      HS,
      server(row('s1', TEE, { club: 'driver' })),
      [queued('q2', GREEN, { club: 'putter', lie_type: 'green', putt_result: 'made' })],
    )
    expect(r.shots.map((s) => s.captured)).toEqual([
      { club: 'driver', lie_type: null, putt_result: null },
      { club: 'putter', lie_type: 'green', putt_result: 'made' },
    ])
  })

  it('counts putts across server and queued rows, placed or not', () => {
    // Server: s1 tee, s2 green (no start). Queued: q3 green. Putts = 2.
    const r = liveHoleShots(
      HS,
      server(row('s1', TEE), row('s2', null, { lie_type: 'green' })),
      [queued('q3', GREEN, { lie_type: 'green' })],
    )
    expect(r.putts).toBe(2)
  })

  it('the latest row decides holed/putt: a queued shot outranks the server rows', () => {
    const madeOnServer = server(row('s1', TEE), row('s2', GREEN, { lie_type: 'green', putt_result: 'made' }))
    expect(liveHoleShots(HS, madeOnServer, [])).toMatchObject({ lastHoled: true, lastPutt: true })
    // A later queued chip from off the green: not holed, not a putt.
    expect(liveHoleShots(HS, madeOnServer, [queued('q3', FAIRWAY)])).toMatchObject({ lastHoled: false, lastPutt: false })
    const madeQueued = [queued('q3', GREEN, { lie_type: 'green', putt_result: 'made' })]
    expect(liveHoleShots(HS, server(row('s1', TEE)), madeQueued)).toMatchObject({ lastHoled: true, lastPutt: true })
  })

  it("another hole's rows don't show under this hole (the render before a hole switch clears them)", () => {
    const old = { holeScoreId: 'hs-0', rows: [row('o1', TEE, { ob: true })] }
    const oldQueued = JSON.stringify({ id: 'o2', hole_score_id: 'hs-0', start_lat: 1, start_lng: 2 })
    const r = liveHoleShots(HS, old, [oldQueued])
    expect(r).toEqual({ shots: [], count: 0, putts: 0, lastHoled: false, lastPutt: false })
    // No hole score yet: nothing.
    expect(liveHoleShots(null, server(row('s1', TEE)), [queued('q2', FAIRWAY)]).count).toBe(0)
  })
})
