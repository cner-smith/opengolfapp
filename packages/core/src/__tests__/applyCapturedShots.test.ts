import { describe, expect, it } from 'vitest'
import { applyCapturedShots, type ReviewedShotRow } from '../round'

const row = (overrides: Partial<ReviewedShotRow> = {}): ReviewedShotRow => ({
  shotNumber: 3,
  club: 'lw',
  lieType: 'rough',
  startLat: 43.84815,
  startLng: -87.73118,
  endLat: 43.848005,
  endLng: -87.730849,
  distanceYards: 30,
  distanceToPin: 30,
  isLastShot: true,
  ...overrides,
})

describe('applyCapturedShots', () => {
  it('keeps a live putt a putt when geometry guessed a wedge from the rough', () => {
    const [out] = applyCapturedShots(
      [row()],
      [{ club: 'putter', lie_type: 'green', putt_result: 'made' }],
    )
    expect(out).toMatchObject({ club: 'putter', lieType: 'green', puttMade: true })
  })

  it('does not call a live missed putt made, even as the last shot', () => {
    const [out] = applyCapturedShots(
      [row({ club: 'putter', lieType: 'green', puttMade: true })],
      [{ club: 'putter', lie_type: 'green', putt_result: null }],
    )
    expect(out!.puttMade).toBeUndefined()
  })

  it('leaves the inferred row alone when the round stored no club or lie', () => {
    const inferred = row({ club: 'putter', lieType: 'green', puttMade: true })
    const out = applyCapturedShots(
      [inferred, row({ shotNumber: 4 })],
      [{ club: null, lie_type: null, putt_result: null }],
    )
    expect(out[0]).toEqual(inferred)
    expect(out[1]).toEqual(row({ shotNumber: 4 }))
  })

  it('does not mutate the rows it was given', () => {
    const input = row()
    const before = { ...input }
    applyCapturedShots([input], [{ club: 'putter', lie_type: 'green', putt_result: 'made' }])
    expect(input).toEqual(before)
  })
})
