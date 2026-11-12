import { describe, expect, it } from 'vitest'
import {
  holeTallyPatch,
  pairReviewedRows,
  type RemoteShotForPairing,
  type ReviewedRowWithId,
} from '../hole-review-save'
import { reviewedRowToShotFields } from '../round'

const MESSAGE = "Couldn't reach this hole's shots — check your connection and save again."

const row = (shotNumber: number, overrides: Partial<ReviewedRowWithId> = {}): ReviewedRowWithId => ({
  shotNumber,
  club: '7i',
  lieType: 'fairway',
  startLat: 35.46,
  startLng: -97.51,
  endLat: 35.47,
  endLng: -97.52,
  distanceYards: 150,
  distanceToPin: 150,
  isLastShot: false,
  ...overrides,
})

// A queued payload as the local queue stores it (JSON).
const local = (id: string, shotNumber: number, aim: number, extra: object = {}) =>
  JSON.stringify({ id, hole_score_id: 'hs1', user_id: 'u1', shot_number: shotNumber, aim_lat: aim, aim_lng: -aim, ...extra })

const remote = (id: string, shotNumber: number, aim: number, penalty = false): RemoteShotForPairing => ({
  id,
  shot_number: shotNumber,
  aim_lat: aim,
  aim_lng: -aim,
  penalty,
})

function pair(over: Partial<Parameters<typeof pairReviewedRows>[0]>) {
  let n = 0
  const minted: string[] = []
  const result = pairReviewedRows({
    rows: [],
    local: [],
    remote: [],
    localOk: true,
    remoteOk: true,
    holeScoreId: 'hs1',
    userId: 'u1',
    newId: () => {
      const id = `new-${++n}`
      minted.push(id)
      return id
    },
    ...over,
  })
  return { result, minted }
}

const ids = (r: ReturnType<typeof pairReviewedRows>) =>
  r instanceof Error ? r : r.map((p) => [p.id, p.shot_number, p.aim_lat])

describe('pairReviewedRows', () => {
  it('pairs by the shot id after a delete renumbers the rows', () => {
    // Live shots a(1), b(2), c(3). The player deleted b in the sheet, so c is
    // now row 2. By id: row 2 → c (aim 3). By number it would get b (aim 2).
    // The server still holds c with an older aim (9): the local queue wins.
    const { result } = pair({
      rows: [row(1, { _shotId: 'a' }), row(2, { _shotId: 'c' })],
      local: [local('a', 1, 1), local('b', 2, 2), local('c', 3, 3)],
      remote: [remote('a', 1, 1), remote('b', 2, 2), remote('c', 3, 9)],
    })
    expect(ids(result)).toEqual([
      ['a', 1, 1],
      ['c', 2, 3],
    ])
  })

  it('a row without a shot id pairs by number, local before remote', () => {
    // Shot 1 is in both (local aim 1 wins over remote aim 9); shot 2 only remote.
    const { result } = pair({
      rows: [row(1), row(2)],
      local: [local('a', 1, 1)],
      remote: [remote('a', 1, 9), remote('b', 2, 2)],
    })
    expect(ids(result)).toEqual([
      ['a', 1, 1],
      ['b', 2, 2],
    ])
  })

  it('falls back to the remote row when the local row was purged', () => {
    // Local queue empty (purged after a past session's sync), read OK. The
    // remote row gives the id, the aim and the stored penalty.
    const r = row(1, { _shotId: 'r1' })
    const { result, minted } = pair({ rows: [r], remote: [remote('r1', 1, 5, true)] })
    expect(result).toEqual([
      {
        id: 'r1',
        hole_score_id: 'hs1',
        user_id: 'u1',
        aim_lat: 5,
        aim_lng: -5,
        ...reviewedRowToShotFields(r, true),
      },
    ])
    expect(result instanceof Error ? null : result[0]!.penalty).toBe(true)
    expect(minted).toEqual([])
  })

  it('aborts when both reads failed', () => {
    const { result, minted } = pair({
      rows: [row(1, { _shotId: 'a' })],
      localOk: false,
      remoteOk: false,
    })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe(MESSAGE)
    expect(minted).toEqual([])
  })

  it.each([
    ['local read failed', { localOk: false, remote: [remote('a', 1, 1)] }],
    ['remote read failed', { remoteOk: false, local: [local('a', 1, 1)] }],
  ])('aborts on an unpaired row when one read failed (%s)', (_name, over) => {
    // Row 2's shot may sit in the read that failed, so it can't be called lost.
    const { result, minted } = pair({ rows: [row(1, { _shotId: 'a' }), row(2, { _shotId: 'b' })], ...over })
    expect(result).toBeInstanceOf(Error)
    expect(minted).toEqual([])
  })

  it('re-creates a lost shot with a new id when both reads answered', () => {
    // Shot b (number 2) is in neither read: quarantined. A new id can't
    // collide on (hole_score_id, shot_number 2), so it is re-created, no aim.
    const { result, minted } = pair({
      rows: [row(1, { _shotId: 'a' }), row(2, { _shotId: 'b' })],
      local: [local('a', 1, 1)],
      remote: [remote('a', 1, 1)],
    })
    expect(ids(result)).toEqual([
      ['a', 1, 1],
      ['new-1', 2, null],
    ])
    expect(minted).toEqual(['new-1'])
  })

  it('never mints an id for a shot number that still exists', () => {
    // Row 2's id pairs to nothing, but shot number 2 is still on the server
    // (id x). A new id would collide on unique(hole_score_id, shot_number).
    for (const over of [
      { remote: [remote('a', 1, 1), remote('x', 2, 2)] },
      { local: [local('a', 1, 1), local('x', 2, 2)] },
    ]) {
      const { result, minted } = pair({ rows: [row(1, { _shotId: 'a' }), row(2, { _shotId: 'gone' })], ...over })
      expect(result).toBeInstanceOf(Error)
      expect(minted).toEqual([])
    }
  })

  it('skips a malformed or id-less local payload', () => {
    // '{bad' can't parse; the id-less payload can't be paired by number. Shot
    // 1 then comes from the remote row.
    const { result } = pair({
      rows: [row(1)],
      local: ['{bad', JSON.stringify({ shot_number: 1, aim_lat: 7 })],
      remote: [remote('r1', 1, 3)],
    })
    expect(ids(result)).toEqual([['r1', 1, 3]])
  })
})

describe('holeTallyPatch', () => {
  const summary = { score: 5, putts: 2, penalties: 0 }
  const unset = { fairway_hit: null, gir: null }
  // Tee, fairway, fairway, then shot 4 starts on the green: on the green in 3.
  const onIn3 = [
    row(1, { lieType: 'tee' }),
    row(2, { lieType: 'fairway' }),
    row(3, { lieType: 'fairway' }),
    row(4, { lieType: 'green' }),
    row(5, { lieType: 'green' }),
  ]

  it('sizes GIR by the par passed in (#1454)', () => {
    // GIR = first green-start shot <= par - 1 - obs.
    // par 5: 4 <= 4 → true. par 4: 4 <= 3 → false.
    expect(holeTallyPatch(onIn3, 5, summary, unset)).toEqual({ ...summary, fairway_hit: true, gir: true })
    expect(holeTallyPatch(onIn3, 4, summary, unset).gir).toBe(false)
  })

  it('counts an OB penalty stroke against GIR', () => {
    // Par 4: tee OB, re-tee, shot 3 starts on the green. 3 <= 4 - 1 - 1 = 2 → false.
    // Without the OB it would be 3 <= 3 → true.
    const rows = [row(1, { lieType: 'tee', shotResult: 'ob' }), row(2, { lieType: 'tee' }), row(3, { lieType: 'green' })]
    expect(holeTallyPatch(rows, 4, summary, unset).gir).toBe(false)
    expect(holeTallyPatch(rows.map((r) => ({ ...r, shotResult: undefined })), 4, summary, unset).gir).toBe(true)
  })

  it('keeps a value already on the hole score', () => {
    // Inferred: fairway true, gir true (par 5). Stored false wins for both.
    expect(holeTallyPatch(onIn3, 5, summary, { fairway_hit: false, gir: false })).toEqual({
      ...summary,
      fairway_hit: false,
      gir: false,
    })
  })

  it('counts a hole-out from off the green (the review is holed out)', () => {
    // Par 5, holed from the fairway with shot 3: no green-start shot, so GIR =
    // last stroke <= par - 2 → 3 <= 3 → true.
    const rows = [row(1, { lieType: 'tee' }), row(2, { lieType: 'fairway' }), row(3, { lieType: 'fairway' })]
    expect(holeTallyPatch(rows, 5, summary, unset).gir).toBe(true)
  })

  it('leaves fairway unset on a par 3', () => {
    expect(holeTallyPatch(onIn3, 3, summary, unset).fairway_hit).toBeNull()
  })
})
